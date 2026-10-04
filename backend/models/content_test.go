package models

import (
	"strings"
	"testing"
	"time"
)

func TestProjectValidation(t *testing.T) {
	published := false
	valid := ProjectInput{ProjectFields: ProjectFields{Title: " Service ", Status: "In Progress", Description: " Description ", Technologies: []string{"Go", " Go ", "React"}}, Published: &published}
	project, err := NewProject(valid, "test-id", time.Now())
	if err != nil || project.Title != "Service" || project.Published || len(project.Technologies) != 2 || project.TechnologyLabel != "Technologies" {
		t.Fatalf("normalization failed: %+v, %v", project, err)
	}
	cases := map[string]func(*ProjectInput){
		"blank title":           func(p *ProjectInput) { p.Title = "  " },
		"long title":            func(p *ProjectInput) { p.Title = strings.Repeat("x", 141) },
		"invalid status":        func(p *ProjectInput) { p.Status = "Winner" },
		"missing published":     func(p *ProjectInput) { p.Published = nil },
		"empty description":     func(p *ProjectInput) { p.Description = "" },
		"invalid icon":          func(p *ProjectInput) { p.Icon = "other" },
		"invalid stack label":   func(p *ProjectInput) { p.TechnologyLabel = "Expert" },
		"empty technology":      func(p *ProjectInput) { p.Technologies = []string{" "} },
		"too many technologies": func(p *ProjectInput) { p.Technologies = make([]string, 31) },
		"NUL character":         func(p *ProjectInput) { p.Title = "bad\x00title" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			input := valid
			change(&input)
			if _, err := NewProject(input, "id", time.Now()); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestAchievementValidation(t *testing.T) {
	published := true
	valid := AchievementInput{AchievementFields: AchievementFields{Title: "Event", Event: "Event", Year: 2026, Result: "Finalist", Team: " AI_Hunter "}, Published: &published}
	record, err := NewAchievement(valid, "id", time.Now())
	if err != nil || record.Result != "Finalist" || record.Team != "AI_Hunter" {
		t.Fatalf("confirmed metadata changed: %+v, %v", record, err)
	}
	cases := map[string]func(*AchievementInput){
		"missing title":     func(a *AchievementInput) { a.Title = "" },
		"missing event":     func(a *AchievementInput) { a.Event = " " },
		"missing result":    func(a *AchievementInput) { a.Result = "" },
		"year too low":      func(a *AchievementInput) { a.Year = 1899 },
		"year too high":     func(a *AchievementInput) { a.Year = 10000 },
		"missing published": func(a *AchievementInput) { a.Published = nil },
		"long description":  func(a *AchievementInput) { a.Description = strings.Repeat("x", 1601) },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			input := valid
			change(&input)
			if _, err := NewAchievement(input, "id", time.Now()); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
