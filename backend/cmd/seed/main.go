// Command seed creates the initial admin account, and with --demo (or
// SEED_DEMO=1) fills the database with a full demo dataset so every screen
// of the parent app and admin panel shows real content.
//
//	go run ./cmd/seed          # admin only (when users table is empty)
//	go run ./cmd/seed --demo   # admin + demo classroom, children, logs, …
package main

import (
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/datatypes"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/sunnystars/backend/internal/config"
	"github.com/sunnystars/backend/internal/model"
	"github.com/sunnystars/backend/internal/pkg/hash"
)

// DemoPassword is shared by all demo accounts (teacher/parents).
const DemoPassword = "SunnyDemo123!"

func main() {
	log := zerolog.New(os.Stdout).With().Timestamp().Logger()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("configuration error")
	}

	db, err := gorm.Open(gormmysql.Open(cfg.DB.DSN()), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		log.Fatal().Err(err).Msg("database connection failed")
	}

	seedAdmin(db, cfg, log)

	if hasArg("--demo") || os.Getenv("SEED_DEMO") == "1" {
		seedDemo(db, log)
	}
	if hasArg("--more") {
		seedMore(db, log)
	}
}

func hasArg(want string) bool {
	for _, a := range os.Args[1:] {
		if a == want {
			return true
		}
	}
	return false
}

func seedAdmin(db *gorm.DB, cfg *config.Config, log zerolog.Logger) {
	var count int64
	if err := db.Model(&model.User{}).Count(&count).Error; err != nil {
		log.Fatal().Err(err).Msg("failed to inspect users table — did you run migrations?")
	}
	if count > 0 {
		log.Info().Msg("users already exist; admin seed skipped")
		return
	}
	if cfg.Seed.AdminEmail == "" || cfg.Seed.AdminPassword == "" {
		log.Fatal().Msg("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (no default credentials)")
	}
	if len(cfg.Seed.AdminPassword) < 12 {
		log.Fatal().Msg("SEED_ADMIN_PASSWORD must be at least 12 characters")
	}
	pwHash, err := hash.Password(cfg.Seed.AdminPassword)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to hash password")
	}
	admin := &model.User{
		Name:         "Administrator",
		Email:        cfg.Seed.AdminEmail,
		PasswordHash: pwHash,
		Role:         model.RoleAdmin,
		Locale:       cfg.App.DefaultLocale,
		Status:       model.UserActive,
	}
	if err := db.Create(admin).Error; err != nil {
		log.Fatal().Err(err).Msg("failed to create admin user")
	}
	log.Info().Str("email", admin.Email).Msg("admin user created — change the password after first login")
}

// seedDemo is idempotent: it bails out if the demo parent already exists.
func seedDemo(db *gorm.DB, log zerolog.Logger) {
	var existing int64
	db.Model(&model.User{}).Where("email = ?", "parent@sunnystars.app").Count(&existing)
	if existing > 0 {
		log.Info().Msg("demo data already present; skipped (delete parent@sunnystars.app to re-seed)")
		return
	}

	pw, err := hash.Password(DemoPassword)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to hash demo password")
	}

	now := time.Now()
	today := now.Format("2006-01-02")
	at := func(hour, min int) time.Time {
		return time.Date(now.Year(), now.Month(), now.Day(), hour, min, 0, 0, time.Local)
	}
	monday := startOfWeek(now)
	date := func(d time.Time) string { return d.Format("2006-01-02") }

	mustCreate := func(name string, value any) {
		if err := db.Create(value).Error; err != nil {
			log.Fatal().Err(err).Str("entity", name).Msg("demo seed failed")
		}
	}

	// ---- users ----
	user := func(name, email string, role model.Role) *model.User {
		u := &model.User{Name: name, Email: email, PasswordHash: pw, Role: role, Locale: "en", Status: model.UserActive}
		mustCreate("user "+email, u)
		return u
	}
	teacher1 := user("Ms. Olivia", "teacher@sunnystars.app", model.RoleTeacher)
	teacher2 := user("Ms. Emma", "teacher2@sunnystars.app", model.RoleTeacher)
	parent1 := user("Sophie Andersson", "parent@sunnystars.app", model.RoleParent)
	parent2 := user("Daniel Berg", "parent2@sunnystars.app", model.RoleParent)

	// ---- classroom + teachers + schedule ----
	room := &model.Classroom{
		Name: "Sunny Stars Room", RoomLocation: "First Floor", AgeGroup: "3–5 years",
		Capacity: 16, OpensAt: "07:00", ClosesAt: "18:00",
	}
	mustCreate("classroom", room)
	mustCreate("teacher assignment", &model.ClassroomTeacher{ClassroomID: room.ID, TeacherUserID: teacher1.ID, Role: "lead"})
	mustCreate("teacher assignment", &model.ClassroomTeacher{ClassroomID: room.ID, TeacherUserID: teacher2.ID, Role: "assistant"})

	scheduleSlots := []struct {
		at, title, desc, icon string
	}{
		{"09:00", "Circle Time", "Stories, songs and morning greetings", "book"},
		{"10:00", "Art Activity", "We're painting with colors!", "color-palette"},
		{"11:30", "Lunch Time", "Healthy and yummy lunch", "restaurant"},
		{"13:00", "Nap Time", "Rest and recharge", "moon"},
		{"15:00", "Outdoor Play", "Games, fresh air and fun!", "football"},
	}
	for weekday := 1; weekday <= 5; weekday++ { // Mon–Fri
		for i, s := range scheduleSlots {
			mustCreate("schedule item", &model.ClassroomScheduleItem{
				ClassroomID: room.ID, Weekday: weekday, StartsAt: s.at,
				Title: s.title, Description: s.desc, Icon: s.icon, Sort: i,
			})
		}
	}

	// ---- children + guardians ----
	checkedIn := at(8, 45)
	child := func(first, last, dob, gender, blood string, present bool) *model.Child {
		c := &model.Child{
			FirstName: first, LastName: last, Gender: gender, BloodType: blood,
			ClassroomID: &room.ID, Status: "active", PresentStatus: model.PresentOut,
		}
		c.DOB, _ = time.Parse("2006-01-02", dob)
		if present {
			c.PresentStatus = model.PresentIn
			c.CheckedInAt = &checkedIn
		}
		mustCreate("child "+first, c)
		return c
	}
	celine := child("Celine", "Andersson", "2022-03-14", "female", "O+", true)
	liam := child("Liam", "Andersson", "2024-01-22", "male", "A+", true)
	noah := child("Noah", "Berg", "2022-07-02", "male", "B+", true)
	emma := child("Emma", "Berg", "2023-05-19", "female", "", false)

	guardian := func(parent *model.User, c *model.Child, rel string, primary bool) {
		mustCreate("guardian", &model.Guardian{
			ParentUserID: parent.ID, ChildID: c.ID, Relationship: rel, IsPrimary: primary, CanPickup: true,
		})
	}
	guardian(parent1, celine, "mother", true)
	guardian(parent1, liam, "mother", true)
	guardian(parent2, noah, "father", true)
	guardian(parent2, emma, "father", true)

	// ---- today's care logs for Celine ----
	meal := func(c *model.Child, mealType, status string, when time.Time, note string) {
		mustCreate("meal", &model.MealLog{ChildID: c.ID, MealType: mealType, Status: status, ServedAt: when, Note: note})
	}
	meal(celine, "breakfast", "ate_well", at(7, 45), "Oatmeal with banana & milk")
	meal(celine, "lunch", "ate_half", at(12, 15), "Chicken, rice, carrots & cucumber — tried broccoli today!")
	meal(celine, "snack", "ate_well", at(15, 30), "Banana & yogurt")
	meal(noah, "breakfast", "ate_well", at(7, 50), "")
	meal(noah, "lunch", "ate_well", at(12, 15), "")

	// A week of meal history for the weekly strip.
	for d := 1; d <= 4; d++ {
		day := monday.AddDate(0, 0, d-1)
		if day.After(now) {
			break
		}
		when := time.Date(day.Year(), day.Month(), day.Day(), 12, 15, 0, 0, time.Local)
		statuses := []string{"ate_well", "ate_half", "ate_well", "ate_little"}
		if !sameDay(day, now) {
			meal(celine, "lunch", statuses[(d-1)%len(statuses)], when, "")
		}
	}

	mustCreate("sleep", &model.SleepLog{
		ChildID: celine.ID, StartAt: at(12, 30), EndAt: at(14, 15), TotalMinutes: 105,
		QualityPct: 85, MoodAfter: "happy", DeepMin: 55, LightMin: 45, AwakeMin: 5, TookToSleepMin: 5,
	})
	for d := 0; d < 4; d++ {
		day := monday.AddDate(0, 0, d)
		if day.After(now) || sameDay(day, now) {
			continue
		}
		start := time.Date(day.Year(), day.Month(), day.Day(), 12, 30, 0, 0, time.Local)
		quality := []int{90, 80, 70, 85}[d%4]
		mins := []int{110, 90, 80, 100}[d%4]
		mustCreate("sleep history", &model.SleepLog{
			ChildID: celine.ID, StartAt: start, EndAt: start.Add(time.Duration(mins) * time.Minute),
			TotalMinutes: mins, QualityPct: quality, MoodAfter: "happy",
			DeepMin: mins / 2, LightMin: mins / 2 * 9 / 10, AwakeMin: mins / 10, TookToSleepMin: 6,
		})
	}

	diaper := func(when time.Time, wetness, stool, comfort, note string) {
		mustCreate("diaper", &model.DiaperLog{ChildID: celine.ID, Time: when, Wetness: wetness, Stool: stool, Comfort: comfort, Note: note})
	}
	diaper(at(8, 20), "wet", "none", "happy", "No rash, comfortable")
	diaper(at(11, 0), "wet", "normal", "happy", "")
	diaper(at(14, 30), "heavy", "none", "happy", "")

	mustCreate("hydration", &model.HydrationLog{ChildID: celine.ID, Date: mustDate(today), Cups: 4, Rating: "good"})

	// ---- diary timeline ----
	diary := func(c *model.Child, typ model.DiaryType, title, body string, when time.Time, live bool) {
		mustCreate("diary", &model.DiaryEntry{
			ChildID: c.ID, Type: typ, Title: title, Body: body,
			OccurredAt: when, LoggedByUserID: teacher1.ID, IsLive: live,
		})
	}
	diary(celine, model.DiaryMeal, "Breakfast", "Oatmeal with banana & milk — ate well!", at(8, 45), false)
	diary(celine, model.DiaryActivity, "Finger Painting Session", "Celine loved mixing blue and yellow colors!", at(10, 38), false)
	diary(celine, model.DiarySleep, "Nap Time", "Slept peacefully for 1h 45m. Woke up happy 😊", at(12, 30), false)
	diary(celine, model.DiaryDiaper, "Diaper Change", "No rash, comfortable", at(14, 30), false)
	diary(celine, model.DiaryActivity, "Outdoor Play", "Celine is enjoying outdoor play with friends.", at(15, 10), true)
	diary(celine, model.DiaryNote, "Note from Teacher",
		"Celine was very active and engaged in all activities today. She shows great curiosity and loves to explore!", at(16, 0), false)

	// ---- weekly menu ----
	menus := []struct {
		day      int
		dish     string
		items    []string
		mealType string
	}{
		{0, "Grilled Chicken with Rice", []string{"Steamed broccoli", "Carrots", "Fresh fruit: Banana"}, "lunch"},
		{1, "Pasta Bolognese", []string{"Garden salad", "Garlic bread", "Fresh fruit: Apple"}, "lunch"},
		{2, "Fish & Mashed Potatoes", []string{"Green peas", "Lemon dip", "Fresh fruit: Pear"}, "lunch"},
		{3, "Vegetable Stew", []string{"Whole-grain bread", "Cheese cubes", "Fresh fruit: Grapes"}, "lunch"},
		{4, "Pancakes with Berries", []string{"Yogurt", "Honey drizzle", "Fresh fruit: Orange"}, "lunch"},
	}
	for _, m := range menus {
		items, _ := jsonArray(m.items)
		menu := &model.WeeklyMenu{
			ClassroomID: room.ID, Date: monday.AddDate(0, 0, m.day), MealType: m.mealType,
			DishName: m.dish, ItemsJSON: items, IsBalanced: true,
		}
		mustCreate("menu", menu)
		if m.day == 0 {
			mustCreate("menu rating", &model.MenuRating{WeeklyMenuID: menu.ID, ChildID: celine.ID, Rating: "eats"})
			mustCreate("menu rating", &model.MenuRating{WeeklyMenuID: menu.ID, ChildID: noah.ID, Rating: "sometimes"})
		}
	}

	// ---- weekly learning plan ----
	plan := &model.WeeklyPlan{
		ClassroomID: room.ID, WeekStart: monday, CreatedBy: teacher1.ID,
		Note: "We're so excited for another week of learning, laughter and growth! Thank you for being part of your child's journey. 💜",
	}
	mustCreate("weekly plan", plan)
	planItem := func(kind model.WeeklyPlanItemKind, day *int, title, desc, icon, color string, sort int) {
		mustCreate("plan item", &model.WeeklyPlanItem{
			WeeklyPlanID: plan.ID, Kind: kind, Day: day, Title: title, Description: desc, Icon: icon, Color: color, Sort: sort,
		})
	}
	planItem(model.PlanLearningArea, nil, "Language", "Learning new words and practicing simple sentences.", "chatbubbles", "#8b5cf6", 0)
	planItem(model.PlanLearningArea, nil, "Cognitive", "Matching shapes and colors, problem solving through play.", "extension-puzzle", "#10b981", 1)
	planItem(model.PlanLearningArea, nil, "Creative", "Exploring colors through painting and craft activities.", "brush", "#f59e0b", 2)
	planItem(model.PlanLearningArea, nil, "Social", "Playing together, sharing, and building friendships.", "people", "#ec4899", 3)
	days := []int{1, 2, 3, 4, 5}
	activities := []struct{ title, desc, icon, color string }{
		{"Story Time", "The Very Hungry Caterpillar", "book", "#10b981"},
		{"Building Blocks", "Building and imagination play", "cube", "#3b82f6"},
		{"Painting Fun", "Finger painting with colors", "color-palette", "#f59e0b"},
		{"Nature Walk", "Exploring leaves and insects", "leaf", "#16a34a"},
		{"Music & Dance", "Singing and movement fun", "musical-notes", "#ec4899"},
	}
	for i, a := range activities {
		planItem(model.PlanActivity, &days[i], a.title, a.desc, a.icon, a.color, i)
	}
	planItem(model.PlanGain, nil, "Confidence", "Encouraging independence and self-expression.", "heart", "#ec4899", 0)
	planItem(model.PlanGain, nil, "Curiosity", "Inspiring questions and a love for learning.", "bulb", "#3b82f6", 1)
	planItem(model.PlanGain, nil, "Kindness", "Learning empathy, sharing and respect.", "hand-left", "#10b981", 2)
	planItem(model.PlanGain, nil, "Focus", "Building attention and problem-solving skills.", "locate", "#f59e0b", 3)

	// ---- milestones + achievements ----
	categories := []struct {
		name, desc, color, icon string
		progress                int
	}{
		{"Communication", "Uses simple sentences and new words", "#10b981", "chatbubbles", 75},
		{"Problem Solving", "Solves simple problems through play", "#3b82f6", "extension-puzzle", 60},
		{"Creativity", "Expresses ideas through art and pretend play", "#f97316", "brush", 80},
		{"Social Skills", "Shares, takes turns, and plays well with others", "#ec4899", "heart", 70},
		{"Cognitive", "Recognizes shapes, colors and patterns", "#8b5cf6", "book", 65},
		{"Independence", "Tries new things and completes tasks", "#f59e0b", "walk", 55},
	}
	for _, cat := range categories {
		mc := &model.MilestoneCategory{Name: cat.name, Description: cat.desc, Color: cat.color, Icon: cat.icon}
		mustCreate("milestone category", mc)
		mustCreate("milestone", &model.ChildMilestone{
			ChildID: celine.ID, CategoryID: mc.ID, ProgressPct: cat.progress,
			Status: "in_progress", AssessedBy: teacher1.ID, AssessedAt: now,
		})
	}
	templates := []struct{ title, desc, icon, color string }{
		{"Kind Helper", "Helped clean up toys without being asked", "thumbs-up", "#10b981"},
		{"Super Listener", "Followed instructions and stayed focused", "star", "#8b5cf6"},
		{"Sharing Star", "Shared toys and played nicely", "heart", "#ef4444"},
		{"Creative Mind", "Great imagination during art time", "color-palette", "#3b82f6"},
	}
	for i, tp := range templates {
		at2 := &model.AchievementTemplate{Title: tp.title, Description: tp.desc, Icon: tp.icon, Color: tp.color}
		mustCreate("achievement template", at2)
		mustCreate("achievement", &model.ChildAchievement{
			ChildID: celine.ID, AchievementTemplateID: at2.ID,
			AwardedDate: now.AddDate(0, 0, -5*i).Format("2006-01-02"), AwardedBy: teacher1.ID,
		})
	}

	// ---- daily report ----
	tips, _ := jsonArray([]string{
		"Encourage hand washing before meals and after play.",
		"Praise her when she shares and takes turns with siblings.",
	})
	moods := datatypes.JSON([]byte(`[{"key":"social","rating":"great"},{"key":"creative","rating":"great"},{"key":"happy","rating":"great"},{"key":"calm","rating":"good"}]`))
	report := &model.DailyReport{
		ChildID: celine.ID, Date: today,
		Summary:       "Celine had a wonderful day! She was happy, engaged and tried her best in all activities.",
		HighlightText: "Celine helped her friend pick up crayons and shared her toys without being asked. 💛",
		HomeTipsJSON:  tips, MoodsJSON: moods, CreatedBy: teacher1.ID,
	}
	mustCreate("daily report", report)
	ratings := []struct {
		dim, rating, note string
	}{
		{"social", "thriving", "Very social today!"},
		{"participation", "thriving", "Loved the art activity!"},
		{"listening", "thriving", "Focused and attentive."},
		{"focus", "doing_well", "Good focus today."},
		{"hygiene", "improving", "Needs reminder sometimes."},
		{"eating", "improving", "Ate half of lunch."},
	}
	for _, r := range ratings {
		mustCreate("report rating", &model.ReportRating{DailyReportID: report.ID, Dimension: r.dim, Rating: r.rating, Note: r.note})
	}

	// ---- health ----
	mustCreate("allergy", &model.Allergy{ChildID: celine.ID, Name: "Peanuts", Severity: "severe"})
	mustCreate("allergy", &model.Allergy{ChildID: celine.ID, Name: "Dairy", Severity: "moderate"})
	mustCreate("vital", &model.VitalLog{
		ChildID: celine.ID, Date: today, Temperature: 36.6, Mood: "Happy", Energy: "High", Appetite: "Good", SleepSummary: "10h 15m",
	})
	mustCreate("illness", &model.IllnessLog{ChildID: celine.ID, Title: "Mild Cough", Status: "resolved", Date: date(now.AddDate(0, 0, -24)), Note: "Recovered"})
	mustCreate("illness", &model.IllnessLog{ChildID: celine.ID, Title: "Fever", Status: "resolved", Temperature: 38.2, Date: date(now.AddDate(0, 0, -27))})
	mustCreate("checkup", &model.Checkup{ChildID: celine.ID, Type: "Routine Checkup", Date: date(now.AddDate(0, 0, -32)), Outcome: "All good", Doctor: "Dr. Lindberg"})
	mustCreate("immunization", &model.Immunization{ChildID: celine.ID, Vaccine: "MMR", GivenDate: date(now.AddDate(-1, 0, 0)), NextDueDate: date(now.AddDate(0, 2, 0)), Status: "up_to_date"})
	mustCreate("immunization", &model.Immunization{ChildID: celine.ID, Vaccine: "DTaP", GivenDate: date(now.AddDate(0, -8, 0)), Status: "up_to_date"})
	mustCreate("contact", &model.EmergencyContact{ChildID: celine.ID, Name: "Sophie Andersson", Relation: "Mother", Phone: "+46701234567", Priority: 1})
	mustCreate("contact", &model.EmergencyContact{ChildID: celine.ID, Name: "Erik Andersson", Relation: "Grandfather", Phone: "+46707654321", Priority: 2})
	mustCreate("insurance", &model.InsuranceInfo{ChildID: celine.ID, Provider: "Folksam Barnförsäkring", PolicyNo: "123456789", Status: "active", ValidUntil: date(now.AddDate(1, 0, 0))})
	mustCreate("growth", &model.GrowthRecord{ChildID: celine.ID, Date: date(now.AddDate(0, -1, 0)), HeightCm: 102, WeightKg: 16.4})
	mustCreate("growth", &model.GrowthRecord{ChildID: celine.ID, Date: date(now.AddDate(0, -4, 0)), HeightCm: 100, WeightKg: 15.8})
	mustCreate("health note", &model.HealthNote{ChildID: celine.ID, Title: "Sleeps best with her teddy", Body: "Celine settles for nap much faster when she has her teddy bear.", AuthoredBy: teacher1.ID})

	// ---- announcements ----
	publish := func(title, body, category string, daysAgo int) {
		publishedAt := now.AddDate(0, 0, -daysAgo)
		mustCreate("announcement", &model.Announcement{
			Title: title, Body: body, Category: category, PublishedAt: &publishedAt, CreatedBy: teacher1.ID,
		})
	}
	publish("New Summer Program! ☀️",
		"Dear Parents,\n\nWe're excited to announce our fun-filled Summer Program starting next month! We've planned a variety of engaging activities to help your child learn, explore, and create wonderful summer memories.\n\nWhat to expect: water play, arts & crafts, storytelling and outdoor games.\n\nA detailed schedule will be shared soon. We look forward to an amazing summer together!\n\nWarm regards,\nThe Administration Team",
		"updates", 0)
	publish("Early Pickup Reminder",
		"This Friday we will close at 13:00 for a staff training session. Please make arrangements for early pickup.",
		"reminders", 2)
	publish("Health & Safety Update",
		"We've updated our illness policy to help keep all children healthy. Please review the new guidelines.",
		"health", 5)

	// ---- events ----
	upcoming := &model.Event{
		Title: "Spring Picnic Day 🧺", Description: "Let's enjoy a fun day outdoors with games, picnic, music and lots of smiles!",
		Location: "Greenfield Park, Main Lawn", Audience: "all",
		StartsAt: time.Date(now.Year(), now.Month(), now.Day(), 10, 0, 0, 0, time.Local).AddDate(0, 0, 10),
		Status:   "upcoming", CreatedBy: teacher1.ID,
	}
	ends := upcoming.StartsAt.Add(3 * time.Hour)
	upcoming.EndsAt = &ends
	mustCreate("event", upcoming)
	mustCreate("event rsvp", &model.EventRSVP{EventID: upcoming.ID, UserID: parent2.ID, Response: "yes"})

	past := &model.Event{
		Title: "Sports Day 🏆", Description: "Fun races, teamwork, and lots of energy! The kids played fun games, shared a picnic lunch, sang songs, and made wonderful memories together.",
		Location: "School Yard", Audience: "all",
		StartsAt: at(9, 0).AddDate(0, 0, -20), Status: "completed", CreatedBy: teacher1.ID,
	}
	mustCreate("event", past)

	// ---- reminders ----
	itemsJSON := func(items []string) datatypes.JSON { j, _ := jsonArray(items); return j }
	tomorrow := now.AddDate(0, 0, 1)
	mustCreate("reminder", &model.Reminder{
		Scope: "classroom", ScopeID: &room.ID, Title: "Sunny Day ☀️",
		Description: "Please make sure your child brings:", Date: date(tomorrow),
		ItemsJSON: itemsJSON([]string{"🧢 Hat", "🧴 Sunscreen", "💧 Water Bottle"}),
		Kind:      "upcoming", WeatherAlert: true, Icon: "sunny", CreatedBy: teacher1.ID,
	})
	mustCreate("reminder", &model.Reminder{
		Scope: "classroom", ScopeID: &room.ID, Title: "Art Day 🎨",
		Description: "We'll be getting creative!", Date: date(now.AddDate(0, 0, 3)),
		ItemsJSON: itemsJSON([]string{"👕 Old T-shirt / Smock"}),
		Kind:      "upcoming", Icon: "color-palette", CreatedBy: teacher1.ID,
	})
	mustCreate("reminder", &model.Reminder{
		Scope: "global", Title: "Extra Clothes",
		Description: "Please pack a change of clothes in your child's bag.",
		Kind:        "general", Icon: "shirt", CreatedBy: teacher1.ID,
	})
	mustCreate("reminder", &model.Reminder{
		Scope: "global", Title: "Water Bottle",
		Description: "Bring a refillable water bottle every day.",
		Kind:        "general", Icon: "water", CreatedBy: teacher1.ID,
	})

	// ---- community ----
	post1 := &model.CommunityPost{
		AuthorUserID: parent2.ID, Type: "moment",
		Body: "Noah is learning guitar! 🎸 He's been so excited about it and loves practicing every day.",
	}
	mustCreate("community post", post1)
	mustCreate("comment", &model.CommunityComment{PostID: post1.ID, AuthorUserID: parent1.ID, Body: "Wow Noah! 🎉 That's amazing! He's so talented! 💗"})
	mustCreate("like", &model.CommunityLike{PostID: post1.ID, UserID: parent1.ID})
	mustCreate("like", &model.CommunityLike{PostID: post1.ID, UserID: teacher1.ID})

	post2 := &model.CommunityPost{
		AuthorUserID: parent2.ID, Type: "activity",
		Body: "We're heading to Greenfield Playground on Saturday at 10:00. Would anyone like to join us? The kids can play together! 😊",
	}
	mustCreate("community post", post2)
	meetupStart := time.Date(now.Year(), now.Month(), now.Day(), 10, 0, 0, 0, time.Local).AddDate(0, 0, 4)
	meetup := &model.Meetup{PostID: post2.ID, Title: "Playground Meetup", Location: "Greenfield Playground, Main Park Area", StartsAt: meetupStart}
	mustCreate("meetup", meetup)
	mustCreate("meetup rsvp", &model.MeetupRSVP{MeetupID: meetup.ID, UserID: parent2.ID, Response: "going"})

	// ---- attendance ----
	confirmedAt := at(8, 45)
	mustCreate("attendance", &model.Attendance{
		ChildID: celine.ID, Date: mustDate(today), Status: model.AttendancePresent,
		CheckedInAt: &checkedIn, ConfirmedBy: &teacher1.ID, ConfirmedAt: &confirmedAt,
	})
	mustCreate("attendance request", &model.Attendance{
		ChildID: noah.ID, Date: mustDate(date(tomorrow)), Status: model.AttendanceLate,
		Note: "Doctor's appointment in the morning", RequestedBy: &parent2.ID,
	})

	// ---- invoices ----
	dueInvoice := &model.Invoice{
		ChildID: celine.ID, PayerUserID: parent1.ID, InvoiceNo: fmt.Sprintf("INV-%s-001", now.Format("012006")),
		Currency: "SEK", TotalMinor: 145000, DueDate: date(now.AddDate(0, 0, 14)),
		Status: model.InvoiceDue, Period: now.Format("2006-01"),
		Items: []model.InvoiceItem{
			{Label: "Tuition Fee", AmountMinor: 120000},
			{Label: "Meal Plan", AmountMinor: 15000},
			{Label: "Transportation", AmountMinor: 10000},
		},
	}
	mustCreate("invoice", dueInvoice)
	lastMonth := now.AddDate(0, -1, 0)
	paidAt := now.AddDate(0, 0, -28)
	paidInvoice := &model.Invoice{
		ChildID: celine.ID, PayerUserID: parent1.ID, InvoiceNo: fmt.Sprintf("INV-%s-001", lastMonth.Format("012006")),
		Currency: "SEK", TotalMinor: 145000, DueDate: date(paidAt),
		Status: model.InvoicePaid, Period: lastMonth.Format("2006-01"),
		Items: []model.InvoiceItem{
			{Label: "Tuition Fee", AmountMinor: 120000},
			{Label: "Meal Plan", AmountMinor: 15000},
			{Label: "Transportation", AmountMinor: 10000},
		},
		Payments: []model.Payment{
			{Provider: "mock", ProviderRef: "demo-" + lastMonth.Format("200601"), AmountMinor: 145000, Status: model.PaymentPaid, PaidAt: &paidAt, InitiatedBy: parent1.ID},
		},
	}
	mustCreate("paid invoice", paidInvoice)

	// ---- notifications for the parent ----
	notify := func(category, title, body string, hoursAgo int, read bool) {
		sent := now.Add(-time.Duration(hoursAgo) * time.Hour)
		n := &model.Notification{UserID: parent1.ID, Category: category, Title: title, Body: body, SentAt: &sent}
		n.CreatedAt = sent
		if read {
			n.ReadAt = &sent
		}
		mustCreate("notification", n)
	}
	notify("updates", "Celine had a great day! 🎨", "We've just posted new photos from Art Activity.", 1, false)
	notify("reminders", "What to Bring Tomorrow ☀️", "Please bring a hat, sunscreen and water bottle.", 2, false)
	notify("updates", "Lunch Update", "Celine had half her lunch and tried something new!", 5, false)
	notify("events", "Upcoming Event Reminder 📅", "Don't forget! Spring Picnic Day is coming up.", 26, true)
	notify("messages", "New Summer Program!", "We're excited to announce our fun-filled Summer Program.", 27, true)

	log.Info().
		Str("teacher", "teacher@sunnystars.app").
		Str("parent", "parent@sunnystars.app").
		Str("parent2", "parent2@sunnystars.app").
		Str("password", DemoPassword).
		Msg("demo data seeded 🎉 — sign into the app as the parent")
}

// seedMore piles a month of history on top of the demo data: daily care logs,
// reports, attendance, plus extra announcements, events, posts and invoices.
// Requires --demo to have run first. Skips if it already ran.
func seedMore(db *gorm.DB, log zerolog.Logger) {
	var parent1, parent2, teacher model.User
	if err := db.Where("email = ?", "parent@sunnystars.app").First(&parent1).Error; err != nil {
		log.Fatal().Msg("--more requires the demo data; run with --demo first")
	}
	_ = db.Where("email = ?", "parent2@sunnystars.app").First(&parent2).Error
	if err := db.Where("email = ?", "teacher@sunnystars.app").First(&teacher).Error; err != nil {
		log.Fatal().Msg("--more requires the demo data; run with --demo first")
	}
	var children []model.Child
	if err := db.Order("id ASC").Find(&children).Error; err != nil || len(children) == 0 {
		log.Fatal().Msg("no children found; run with --demo first")
	}

	var mealCount int64
	db.Model(&model.MealLog{}).Count(&mealCount)
	if mealCount > 60 {
		log.Info().Msg("bulk history already present; --more skipped")
		return
	}

	mustCreate := func(name string, value any) {
		if err := db.Create(value).Error; err != nil {
			log.Fatal().Err(err).Str("entity", name).Msg("bulk seed failed")
		}
	}

	now := time.Now()
	mealStatuses := []string{"ate_well", "ate_well", "ate_half", "ate_well", "ate_little", "ate_well", "ate_half"}
	moods := []string{"happy", "calm", "energetic", "happy", "sleepy"}
	wetness := []string{"wet", "wet", "heavy", "dry"}
	stools := []string{"none", "normal", "none", "soft"}
	activityTitles := []string{
		"Finger Painting", "Building Blocks", "Story Time", "Music & Dance",
		"Nature Walk", "Puzzle Play", "Sand Box Fun", "Dress-Up Corner",
	}
	activityBodies := []string{
		"Loved mixing colors and made a beautiful picture!",
		"Built a tall tower and counted the blocks.",
		"Listened carefully and answered questions about the story.",
		"Danced and sang along with the whole group.",
		"Collected leaves and spotted a ladybug!",
		"Finished a 12-piece puzzle all alone.",
		"Built sandcastles with friends.",
		"Played pretend kitchen with friends.",
	}

	// ---- 30 days of care history for every child ----
	for ci, child := range children {
		for d := 1; d <= 30; d++ {
			day := now.AddDate(0, 0, -d)
			if wd := day.Weekday(); wd == time.Saturday || wd == time.Sunday {
				continue
			}
			at := func(hour, min int) time.Time {
				return time.Date(day.Year(), day.Month(), day.Day(), hour, min, 0, 0, time.Local)
			}
			idx := d + ci // deterministic variety per child/day

			mustCreate("meal", &model.MealLog{ChildID: child.ID, MealType: "breakfast", Status: mealStatuses[idx%len(mealStatuses)], ServedAt: at(7, 45)})
			mustCreate("meal", &model.MealLog{ChildID: child.ID, MealType: "lunch", Status: mealStatuses[(idx+2)%len(mealStatuses)], ServedAt: at(12, 15)})
			mustCreate("meal", &model.MealLog{ChildID: child.ID, MealType: "snack", Status: mealStatuses[(idx+4)%len(mealStatuses)], ServedAt: at(15, 30)})

			mins := 80 + (idx*7)%50
			quality := 60 + (idx*11)%40
			mustCreate("sleep", &model.SleepLog{
				ChildID: child.ID, StartAt: at(12, 30), EndAt: at(12, 30).Add(time.Duration(mins) * time.Minute),
				TotalMinutes: mins, QualityPct: quality, MoodAfter: moods[idx%len(moods)],
				DeepMin: mins * 52 / 100, LightMin: mins * 43 / 100, AwakeMin: mins * 5 / 100, TookToSleepMin: 3 + idx%9,
			})

			for j := 0; j < 2+idx%2; j++ {
				mustCreate("diaper", &model.DiaperLog{
					ChildID: child.ID, Time: at(8+j*3, 20), Wetness: wetness[(idx+j)%len(wetness)],
					Stool: stools[(idx+j)%len(stools)], Comfort: "happy",
				})
			}

			mustCreate("hydration", &model.HydrationLog{ChildID: child.ID, Date: day, Cups: 3 + idx%4, Rating: "good"})

			a := idx % len(activityTitles)
			mustCreate("diary", &model.DiaryEntry{
				ChildID: child.ID, Type: model.DiaryActivity, Title: activityTitles[a], Body: activityBodies[a],
				OccurredAt: at(10, 15), LoggedByUserID: teacher.ID, IsLive: false,
			})
			mustCreate("diary", &model.DiaryEntry{
				ChildID: child.ID, Type: model.DiarySleep, Title: "Nap Time",
				Body: fmt.Sprintf("Slept for %dh %dm and woke up %s.", mins/60, mins%60, moods[idx%len(moods)]),
				OccurredAt: at(12, 30), LoggedByUserID: teacher.ID, IsLive: false,
			})

			checkIn := at(8, 30+idx%20)
			checkOut := at(16, 30+idx%25)
			mustCreate("attendance", &model.Attendance{
				ChildID: child.ID, Date: time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC),
				Status: model.AttendancePresent, CheckedInAt: &checkIn, CheckedOutAt: &checkOut,
				ConfirmedBy: &teacher.ID, ConfirmedAt: &checkIn,
			})
		}
	}

	// ---- two weeks of daily reports for the first child ----
	celine := children[0]
	summaries := []string{
		"A joyful day full of curiosity and laughter!",
		"Worked hard on puzzles and shared with friends.",
		"Loved music time and sang the loudest!",
		"A calm, focused day — great listening skills.",
		"Played outside a lot and made a new friend.",
	}
	ratingsPool := []string{"thriving", "doing_well", "doing_well", "improving", "thriving"}
	for d := 1; d <= 14; d++ {
		day := now.AddDate(0, 0, -d)
		if wd := day.Weekday(); wd == time.Saturday || wd == time.Sunday {
			continue
		}
		moodsJSON := datatypes.JSON([]byte(`[{"key":"social","rating":"great"},{"key":"creative","rating":"good"},{"key":"happy","rating":"great"},{"key":"calm","rating":"good"}]`))
		tips, _ := jsonArray([]string{"Read a story together tonight.", "Practice counting during dinner."})
		report := &model.DailyReport{
			ChildID: celine.ID, Date: day.Format("2006-01-02"),
			Summary: summaries[d%len(summaries)], HomeTipsJSON: tips, MoodsJSON: moodsJSON, CreatedBy: teacher.ID,
		}
		mustCreate("report", report)
		for di, dim := range []string{"social", "participation", "listening", "focus", "hygiene", "eating"} {
			mustCreate("report rating", &model.ReportRating{
				DailyReportID: report.ID, Dimension: dim, Rating: ratingsPool[(d+di)%len(ratingsPool)],
			})
		}
	}

	// ---- more announcements ----
	announcements := []struct {
		title, body, category string
		daysAgo               int
	}{
		{"Class Photo Day 📸", "Class photos will be taken next Wednesday. Please make sure your child comes to school on time and ready to smile!", "updates", 8},
		{"Center Closed: Midsummer", "Our center will be closed on Friday in observance of Midsummer.", "general", 12},
		{"Parent Meeting", "Join us Thursday at 18:00 for our monthly parent meeting. We look forward to seeing you!", "events", 15},
		{"New Menu This Month 🥗", "Our nutritionist has refreshed the lunch menu with seasonal vegetables and new dishes.", "updates", 18},
		{"Lost & Found Overflowing", "Please check the lost & found box by the entrance — we have many unclaimed jackets and water bottles.", "reminders", 21},
		{"Flu Season Tips 🤧", "A few simple habits help keep everyone healthy: wash hands often and keep sick children home until fever-free for 24h.", "health", 25},
		{"Library Visit", "Next Tuesday we walk to the local library for story hour. Permission slips go home today.", "events", 30},
		{"Welcome Ms. Sophia!", "Please join us in welcoming Ms. Sophia, our new assistant teacher in the Sunny Stars Room.", "general", 35},
	}
	for _, a := range announcements {
		publishedAt := now.AddDate(0, 0, -a.daysAgo)
		mustCreate("announcement", &model.Announcement{
			Title: a.title, Body: a.body, Category: a.category, PublishedAt: &publishedAt, CreatedBy: teacher.ID,
		})
	}

	// ---- more events ----
	events := []struct {
		title, desc, location string
		daysFromNow           int
		status                string
	}{
		{"Family BBQ Evening 🍔", "An evening of grilling, games and getting to know other families.", "School Garden", 21, "upcoming"},
		{"Teddy Bear Picnic 🧸", "Bring your favorite teddy for a cozy picnic with songs and snacks.", "Greenfield Park", 35, "upcoming"},
		{"Halloween Party 🎃", "Spooky fun, games, and lots of treats!", "Main Hall", -45, "completed"},
		{"Christmas Celebration 🎄", "Carols, games, and festive joy for everyone.", "Main Hall", -60, "completed"},
		{"Parents Day 💖", "A special day to celebrate our amazing parents.", "Sunny Stars Room", -75, "completed"},
	}
	for _, e := range events {
		starts := time.Date(now.Year(), now.Month(), now.Day(), 10, 0, 0, 0, time.Local).AddDate(0, 0, e.daysFromNow)
		ends := starts.Add(2 * time.Hour)
		mustCreate("event", &model.Event{
			Title: e.title, Description: e.desc, Location: e.location, Audience: "all",
			StartsAt: starts, EndsAt: &ends, Status: e.status, CreatedBy: teacher.ID,
		})
	}

	// ---- more community posts ----
	if parent2.ID != 0 {
		posts := []struct {
			author uint64
			body   string
			days   int
		}{
			{parent2.ID, "Beautiful day for a walk in the park with Emma 🌳☀️", 1},
			{parent1.ID, "Celine drew her first family portrait today — fridge-worthy! 🖼️", 2},
			{parent2.ID, "Anyone else's kid obsessed with dinosaurs right now? 🦕 Looking for book recommendations!", 4},
			{parent1.ID, "Thank you Ms. Olivia for the wonderful week — Celine talks about school all weekend! 💜", 6},
			{parent2.ID, "Noah lost his first tooth! The tooth fairy was generous 😁", 9},
		}
		for _, p := range posts {
			post := &model.CommunityPost{AuthorUserID: p.author, Type: "moment", Body: p.body}
			post.CreatedAt = now.AddDate(0, 0, -p.days)
			mustCreate("post", post)
			other := parent1.ID
			if p.author == parent1.ID {
				other = parent2.ID
			}
			mustCreate("like", &model.CommunityLike{PostID: post.ID, UserID: other})
			mustCreate("comment", &model.CommunityComment{PostID: post.ID, AuthorUserID: other, Body: "Love this! 💛"})
		}
	}

	// ---- more notifications ----
	notifTitles := []struct{ category, title, body string }{
		{"updates", "New photos from Art Activity", "We've added new photos of your child and friends."},
		{"updates", "Nap Time Update", "Your child had a good nap and is feeling refreshed."},
		{"reminders", "Library Day Tomorrow", "Don't forget the library book bag!"},
		{"events", "RSVP Reminder", "Please RSVP for the Family BBQ Evening."},
		{"messages", "New announcement", "Class Photo Day is coming up."},
	}
	for i := 0; i < 15; i++ {
		n := notifTitles[i%len(notifTitles)]
		sent := now.Add(-time.Duration(30+i*9) * time.Hour)
		read := &sent
		row := &model.Notification{UserID: parent1.ID, Category: n.category, Title: n.title, Body: n.body, SentAt: &sent, ReadAt: read}
		row.CreatedAt = sent
		mustCreate("notification", row)
	}

	// ---- six months of paid invoices ----
	for m := 2; m <= 6; m++ {
		period := now.AddDate(0, -m, 0)
		paidAt := period.AddDate(0, 0, 25)
		mustCreate("invoice", &model.Invoice{
			ChildID: celine.ID, PayerUserID: parent1.ID,
			InvoiceNo: fmt.Sprintf("INV-%s-001", period.Format("012006")),
			Currency:  "SEK", TotalMinor: 145000, DueDate: period.AddDate(0, 0, 28).Format("2006-01-02"),
			Status: model.InvoicePaid, Period: period.Format("2006-01"),
			Items: []model.InvoiceItem{
				{Label: "Tuition Fee", AmountMinor: 120000},
				{Label: "Meal Plan", AmountMinor: 15000},
				{Label: "Transportation", AmountMinor: 10000},
			},
			Payments: []model.Payment{{
				Provider: "mock", ProviderRef: "demo-" + period.Format("200601"),
				AmountMinor: 145000, Status: model.PaymentPaid, PaidAt: &paidAt, InitiatedBy: parent1.ID,
			}},
		})
	}

	log.Info().Msg("bulk history seeded 📦 — 30 days of logs, 14 reports, extra announcements/events/posts/invoices")
}

func startOfWeek(t time.Time) time.Time {
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return t.AddDate(0, 0, 1-weekday)
}

func sameDay(a, b time.Time) bool {
	return a.Year() == b.Year() && a.YearDay() == b.YearDay()
}

func mustDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

func jsonArray(items []string) (datatypes.JSON, error) {
	b := []byte("[")
	for i, it := range items {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendJSONString(b, it)
	}
	b = append(b, ']')
	return datatypes.JSON(b), nil
}

func appendJSONString(b []byte, s string) []byte {
	b = append(b, '"')
	for _, r := range s {
		switch r {
		case '"':
			b = append(b, '\\', '"')
		case '\\':
			b = append(b, '\\', '\\')
		case '\n':
			b = append(b, '\\', 'n')
		default:
			b = append(b, []byte(string(r))...)
		}
	}
	return append(b, '"')
}
