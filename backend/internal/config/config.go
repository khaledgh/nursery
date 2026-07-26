package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	App      AppConfig
	DB       DBConfig
	Auth     AuthConfig
	Storage  StorageConfig
	OneSig   OneSignalConfig
	Swish    SwishConfig
	Weather  WeatherConfig
	Seed     SeedConfig
}

type AppConfig struct {
	Env           string   `env:"APP_ENV" envDefault:"development"`
	Port          int      `env:"APP_PORT" envDefault:"8080"`
	URL           string   `env:"APP_URL" envDefault:"http://localhost:8080"`
	DefaultLocale string   `env:"DEFAULT_LOCALE" envDefault:"en"`
	CORSOrigins   []string `env:"CORS_ORIGINS" envSeparator:"," envDefault:"http://localhost:5173"`
}

type DBConfig struct {
	Host     string `env:"DB_HOST" envDefault:"localhost"`
	Port     int    `env:"DB_PORT" envDefault:"3306"`
	Name     string `env:"DB_NAME,required"`
	User     string `env:"DB_USER,required"`
	Password string `env:"DB_PASSWORD,required"`
}

type AuthConfig struct {
	AccessSecret  string        `env:"JWT_ACCESS_SECRET,required"`
	RefreshSecret string        `env:"JWT_REFRESH_SECRET,required"`
	AccessTTL     time.Duration `env:"JWT_ACCESS_TTL" envDefault:"15m"`
	RefreshTTL    time.Duration `env:"JWT_REFRESH_TTL" envDefault:"720h"`
}

type StorageConfig struct {
	Driver         string `env:"STORAGE_DRIVER" envDefault:"local"`
	LocalUploadDir string `env:"LOCAL_UPLOAD_DIR" envDefault:"./uploads"`
	// Signs local media URLs so <img>/<Image> can load them without an auth
	// header. Falls back to the access secret when unset.
	MediaURLSecret string        `env:"MEDIA_URL_SECRET"`
	MediaURLTTL    time.Duration `env:"MEDIA_URL_TTL" envDefault:"24h"`
	S3Bucket       string `env:"S3_BUCKET"`
	S3Region       string `env:"S3_REGION"`
	S3AccessKey    string `env:"S3_ACCESS_KEY"`
	S3SecretKey    string `env:"S3_SECRET_KEY"`
	S3Endpoint     string `env:"S3_ENDPOINT"`
}

type OneSignalConfig struct {
	AppID  string `env:"ONESIGNAL_APP_ID"`
	APIKey string `env:"ONESIGNAL_API_KEY"`
}

type SwishConfig struct {
	MerchantID  string `env:"SWISH_MERCHANT_ID"`
	CertPath    string `env:"SWISH_CERT_PATH"`
	CallbackURL string `env:"SWISH_CALLBACK_URL"`
}

type WeatherConfig struct {
	APIKey string `env:"WEATHER_API_KEY"`
}

type SeedConfig struct {
	AdminEmail    string `env:"SEED_ADMIN_EMAIL"`
	AdminPassword string `env:"SEED_ADMIN_PASSWORD"`
}

// Load reads .env (if present) and the process environment into a validated Config.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	const minSecretLen = 32
	if len(c.Auth.AccessSecret) < minSecretLen || len(c.Auth.RefreshSecret) < minSecretLen {
		return fmt.Errorf("config: JWT secrets must be at least %d characters", minSecretLen)
	}
	if c.Auth.AccessSecret == c.Auth.RefreshSecret {
		return fmt.Errorf("config: JWT access and refresh secrets must differ")
	}
	if strings.Contains(c.Auth.AccessSecret, "change-me") || strings.Contains(c.Auth.RefreshSecret, "change-me") {
		return fmt.Errorf("config: JWT secrets still contain the placeholder value — generate real secrets")
	}
	switch c.Storage.Driver {
	case "local", "s3":
	default:
		return fmt.Errorf("config: STORAGE_DRIVER must be 'local' or 's3', got %q", c.Storage.Driver)
	}
	if c.Storage.Driver == "s3" && (c.Storage.S3Bucket == "" || c.Storage.S3Region == "") {
		return fmt.Errorf("config: S3 storage requires S3_BUCKET and S3_REGION")
	}
	return nil
}

func (c *Config) IsProduction() bool { return c.App.Env == "production" }

// DSN builds the MySQL connection string. parseTime is required for time.Time scanning.
func (c *DBConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=UTC",
		c.User, c.Password, c.Host, c.Port, c.Name)
}
