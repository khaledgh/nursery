package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/sunnystars/backend/internal/config"
	"github.com/sunnystars/backend/internal/database"
	"github.com/sunnystars/backend/internal/dto"
	"github.com/sunnystars/backend/internal/handler"
	"github.com/sunnystars/backend/internal/job"
	mw "github.com/sunnystars/backend/internal/middleware"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/notification"
	"github.com/sunnystars/backend/internal/payment"
	"github.com/sunnystars/backend/internal/pkg/apperr"
	"github.com/sunnystars/backend/internal/pkg/jwtutil"
	"github.com/sunnystars/backend/internal/pkg/response"
	"github.com/sunnystars/backend/internal/repository"
	"github.com/sunnystars/backend/internal/service"
	"github.com/sunnystars/backend/internal/storage"
)

func main() {
	log := zerolog.New(os.Stdout).With().Timestamp().Logger()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("configuration error")
	}

	if err := database.Migrate(cfg.DB.DSN()); err != nil {
		log.Fatal().Err(err).Msg("database migration failed")
	}
	log.Info().Msg("database schema up to date")

	db, err := openDB(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("database connection failed")
	}

	signer := mediaSigner(cfg)
	store, err := buildStorage(cfg, signer)
	if err != nil {
		log.Fatal().Err(err).Msg("storage init failed")
	}
	// Re-sign local media URLs on every read; the column value is stale by design.
	if local, ok := store.(*storage.LocalStorage); ok {
		model.MediaURLBuilder = local.URL
	}

	jwts := jwtutil.NewManager(cfg.Auth.AccessSecret, cfg.Auth.AccessTTL, cfg.App.URL)

	// Repositories
	userRepo := repository.NewUserRepo(db)
	tokenRepo := repository.NewTokenRepo(db)
	childRepo := repository.NewChildRepo(db)
	classroomRepo := repository.NewClassroomRepo(db)
	attendanceRepo := repository.NewAttendanceRepo(db)
	careRepo := repository.NewCareRepo(db)

	// Push / payments integrations
	onesignal := notification.NewOneSignalClient(cfg.OneSig.AppID, cfg.OneSig.APIKey)
	if !onesignal.Enabled() {
		log.Warn().Msg("OneSignal keys not set — push disabled, in-app notifications still stored")
	}
	provider := buildPaymentProvider(cfg, log)

	// Services
	auditSvc := service.NewAuditService(db, log)
	localeSvc := service.NewLocaleService(db, cfg.App.DefaultLocale)
	notifier := service.NewNotificationService(db, onesignal, log)
	authSvc := service.NewAuthService(userRepo, tokenRepo, jwts, cfg.Auth.RefreshTTL, log)
	userSvc := service.NewUserService(userRepo, tokenRepo, auditSvc)
	childSvc := service.NewChildService(childRepo, userRepo, auditSvc)
	classroomSvc := service.NewClassroomService(classroomRepo, userRepo, localeSvc, auditSvc)
	attendanceSvc := service.NewAttendanceService(attendanceRepo, childRepo, childSvc, auditSvc, notifier)
	mediaSvc := service.NewMediaService(db, store)
	careSvc := service.NewCareService(careRepo, childRepo, classroomRepo, childSvc, notifier, auditSvc)
	healthSvc := service.NewHealthService(db, childSvc, auditSvc, notifier)
	devSvc := service.NewDevelopmentService(db, childSvc, notifier, auditSvc)
	translationSvc := service.NewTranslationService(db, localeSvc)
	engagementSvc := service.NewEngagementService(db, childRepo, childSvc, notifier, auditSvc, translationSvc)
	centerSvc := service.NewNotificationCenterService(db)
	settingsSvc := service.NewSettingsService(db, auditSvc)
	localeAdminSvc := service.NewLocaleAdminService(db, localeSvc, auditSvc)
	paymentSvc := service.NewPaymentService(db, childRepo, provider, notifier, auditSvc, log)

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errorHandler(log)
	e.Validator = dto.NewValidator()

	// Global middleware
	e.Use(echomw.RequestID())
	e.Use(echomw.Recover())
	e.Use(requestLogger(log))
	e.Use(mw.SecurityHeaders())
	e.Use(echomw.BodyLimit("16M"))
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: cfg.App.CORSOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderAuthorization, echo.HeaderContentType, "Accept-Language"},
		MaxAge:       3600,
	}))
	e.Use(mw.Locale(localeSvc))

	e.GET("/healthz", func(c echo.Context) error {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.PingContext(c.Request().Context()) != nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	api := e.Group("/api/v1")

	// Brute-force brake on the unauthenticated auth endpoints.
	authLimiter := echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
			Rate: rate.Limit(5), Burst: 10, ExpiresIn: 3 * time.Minute,
		}),
		ErrorHandler: func(c echo.Context, err error) error {
			return response.Err(c, http.StatusTooManyRequests, "rate_limited", "too many requests", nil)
		},
		DenyHandler: func(c echo.Context, identifier string, err error) error {
			return response.Err(c, http.StatusTooManyRequests, "rate_limited", "too many requests, slow down", nil)
		},
	})
	public := api.Group("", authLimiter)
	protected := api.Group("", mw.JWT(jwts))
	// Signed media URLs are unauthenticated but must not share the auth
	// brute-force limiter: one gallery view is dozens of image requests.
	media := api.Group("")

	// Public locale list so clients can render the language picker pre-login.
	api.GET("/locales", func(c echo.Context) error {
		locales, err := localeSvc.List(c.Request().Context())
		if err != nil {
			return apperr.Internal(err)
		}
		return response.OK(c, locales)
	})

	handler.NewAuthHandler(authSvc, localeSvc).Register(public, protected)
	handler.NewUserHandler(userSvc).Register(protected)
	handler.NewChildHandler(childSvc).Register(protected)
	handler.NewClassroomHandler(classroomSvc).Register(protected)
	handler.NewAttendanceHandler(attendanceSvc).Register(protected)
	handler.NewMediaHandler(mediaSvc, signer).Register(media, protected)
	handler.NewCareHandler(careSvc).Register(protected)
	handler.NewHealthHandler(healthSvc).Register(protected)
	handler.NewDevelopmentHandler(devSvc).Register(protected)
	handler.NewEngagementHandler(engagementSvc, centerSvc).Register(protected)

	paymentHandler := handler.NewPaymentHandler(paymentSvc)
	paymentHandler.Register(protected)
	paymentHandler.RegisterWebhook(public) // gateway callback: no JWT, rate-limited, verifies via gateway

	platformHandler := handler.NewPlatformHandler(translationSvc, settingsSvc, localeAdminSvc, localeSvc)
	platformHandler.RegisterPublic(api)
	platformHandler.Register(protected)

	// Background jobs
	jobs := job.NewRunner(db, paymentSvc, tokenRepo, notifier, engagementSvc, log)
	jobs.Start()
	defer jobs.Stop()

	// Start + graceful shutdown
	go func() {
		addr := fmt.Sprintf(":%d", cfg.App.Port)
		log.Info().Str("addr", addr).Str("env", cfg.App.Env).Msg("api listening")
		if err := e.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Info().Msg("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("forced shutdown")
	}
}

func openDB(cfg *config.Config) (*gorm.DB, error) {
	gcfg := &gorm.Config{
		Logger:  gormlogger.Default.LogMode(gormlogger.Warn),
		NowFunc: func() time.Time { return time.Now().UTC() },
	}
	db, err := gorm.Open(gormmysql.Open(cfg.DB.DSN()), gcfg)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}

// buildPaymentProvider picks Swish when configured. Without Swish config,
// development gets the auto-approving mock; production gets a provider that
// refuses to initiate payments rather than faking them.
func buildPaymentProvider(cfg *config.Config, log zerolog.Logger) payment.Provider {
	if cfg.Swish.MerchantID != "" && cfg.Swish.CertPath != "" {
		p, err := payment.NewSwishProvider(cfg.Swish.MerchantID, cfg.Swish.CertPath, cfg.Swish.CallbackURL)
		if err != nil {
			log.Fatal().Err(err).Msg("swish configuration is set but invalid")
		}
		return p
	}
	if cfg.IsProduction() {
		log.Warn().Msg("Swish not configured — payment initiation disabled in production")
		return payment.DisabledProvider{}
	}
	log.Warn().Msg("Swish not configured — using mock payment provider (development only)")
	return payment.NewMockProvider()
}

// mediaSigner is nil for s3, which issues its own presigned URLs. For local disk
// it both stamps outgoing URLs and verifies incoming ones, so the two must share
// one instance.
func mediaSigner(cfg *config.Config) *storage.Signer {
	if cfg.Storage.Driver == "s3" {
		return nil
	}
	secret := cfg.Storage.MediaURLSecret
	if secret == "" {
		secret = cfg.Auth.AccessSecret
	}
	return storage.NewSigner(secret, cfg.Storage.MediaURLTTL)
}

func buildStorage(cfg *config.Config, signer *storage.Signer) (storage.Storage, error) {
	switch cfg.Storage.Driver {
	case "s3":
		return storage.NewS3Storage(context.Background(), storage.S3Options{
			Bucket:    cfg.Storage.S3Bucket,
			Region:    cfg.Storage.S3Region,
			AccessKey: cfg.Storage.S3AccessKey,
			SecretKey: cfg.Storage.S3SecretKey,
			Endpoint:  cfg.Storage.S3Endpoint,
		})
	default:
		return storage.NewLocalStorage(cfg.Storage.LocalUploadDir, cfg.App.URL, signer)
	}
}

// errorHandler converts apperr and echo errors to the response envelope.
// Internal causes are logged with the request id but never sent to clients.
func errorHandler(log zerolog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		var he *echo.HTTPError
		if errors.As(err, &he) {
			msg := http.StatusText(he.Code)
			if s, ok := he.Message.(string); ok {
				msg = s
			}
			_ = response.Err(c, he.Code, "http_error", msg, nil)
			return
		}
		ae := apperr.From(err)
		if ae.Code == apperr.CodeInternal {
			log.Error().Err(ae.Err).
				Str("request_id", c.Response().Header().Get(echo.HeaderXRequestID)).
				Str("path", c.Request().URL.Path).
				Msg("internal error")
		}
		_ = response.Err(c, ae.HTTPStatus(), string(ae.Code), ae.Message, ae.Fields)
	}
}

func requestLogger(log zerolog.Logger) echo.MiddlewareFunc {
	return echomw.RequestLoggerWithConfig(echomw.RequestLoggerConfig{
		LogStatus: true, LogURI: true, LogMethod: true, LogLatency: true, LogRequestID: true,
		LogValuesFunc: func(c echo.Context, v echomw.RequestLoggerValues) error {
			log.Info().
				Str("request_id", v.RequestID).
				Str("method", v.Method).
				Str("uri", v.URI).
				Int("status", v.Status).
				Dur("latency", v.Latency).
				Msg("request")
			return nil
		},
	})
}
