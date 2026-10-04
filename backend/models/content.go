package models

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

type Metadata struct {
	ID        string    `json:"id" bson:"_id"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" bson:"updatedAt"`
}

type ProjectFields struct {
	Title           string   `json:"title" bson:"title"`
	Category        string   `json:"category" bson:"category"`
	Status          string   `json:"status" bson:"status"`
	Description     string   `json:"description" bson:"description"`
	Technologies    []string `json:"technologies" bson:"technologies"`
	TechnologyLabel string   `json:"technologyLabel" bson:"technologyLabel"`
	Icon            string   `json:"icon" bson:"icon"`
}

type ProjectInput struct {
	ProjectFields
	Published *bool `json:"published"`
}

type Project struct {
	Metadata      `bson:",inline"`
	ProjectFields `bson:",inline"`
	Published     bool `json:"published" bson:"published"`
}

type AchievementFields struct {
	Title       string `json:"title" bson:"title"`
	Event       string `json:"event" bson:"event"`
	Year        int    `json:"year" bson:"year"`
	Description string `json:"description" bson:"description"`
	Result      string `json:"result" bson:"result"`
	Team        string `json:"team,omitempty" bson:"team"`
	Division    string `json:"division,omitempty" bson:"division"`
}

type AchievementInput struct {
	AchievementFields
	Published *bool `json:"published"`
}

type Achievement struct {
	Metadata          `bson:",inline"`
	AchievementFields `bson:",inline"`
	Published         bool `json:"published" bson:"published"`
}

func NewProject(input ProjectInput, id string, now time.Time) (Project, error) {
	f := input.ProjectFields
	f.Title, f.Category, f.Description = strings.TrimSpace(f.Title), strings.TrimSpace(f.Category), strings.TrimSpace(f.Description)
	if !validText(f.Title, 140, true) || !validText(f.Description, 1600, true) || !validText(f.Category, 100, false) {
		return Project{}, errors.New("title must contain 1-140 characters, description 1-1600, and optional category at most 100")
	}
	if f.Status != "Completed" && f.Status != "In Progress" {
		return Project{}, errors.New("status must be Completed or In Progress")
	}
	if input.Published == nil {
		return Project{}, errors.New("published must be a boolean")
	}
	if f.Icon == "" {
		f.Icon = "link"
	}
	if f.Icon != "link" && f.Icon != "ai" && f.Icon != "dashboard" {
		return Project{}, errors.New("icon must be link, ai, or dashboard")
	}
	if f.TechnologyLabel == "" {
		f.TechnologyLabel = "Technologies"
	}
	if f.TechnologyLabel != "Technologies" && f.TechnologyLabel != "Proposed stack" {
		return Project{}, errors.New("technologyLabel must be Technologies or Proposed stack")
	}
	if len(f.Technologies) > 30 {
		return Project{}, errors.New("technologies must contain at most 30 names")
	}
	tags := make([]string, 0, len(f.Technologies))
	seen := map[string]bool{}
	for _, tag := range f.Technologies {
		tag = strings.TrimSpace(tag)
		if !validText(tag, 60, true) {
			return Project{}, errors.New("each technology must contain 1-60 characters")
		}
		if !seen[tag] {
			tags = append(tags, tag)
			seen[tag] = true
		}
	}
	f.Technologies = tags
	return Project{Metadata: Metadata{id, now, now}, ProjectFields: f, Published: *input.Published}, nil
}

func NewAchievement(input AchievementInput, id string, now time.Time) (Achievement, error) {
	f := input.AchievementFields
	f.Title, f.Event, f.Description, f.Result = strings.TrimSpace(f.Title), strings.TrimSpace(f.Event), strings.TrimSpace(f.Description), strings.TrimSpace(f.Result)
	f.Team, f.Division = strings.TrimSpace(f.Team), strings.TrimSpace(f.Division)
	if !validText(f.Title, 160, true) || !validText(f.Event, 160, true) || !validText(f.Result, 100, true) {
		return Achievement{}, errors.New("title and event must contain 1-160 characters; result must contain 1-100")
	}
	if f.Year < 1900 || f.Year > 9999 {
		return Achievement{}, errors.New("year must be between 1900 and 9999")
	}
	if !validText(f.Description, 1600, false) || !validText(f.Team, 100, false) || !validText(f.Division, 100, false) {
		return Achievement{}, errors.New("description, team, or division exceeds its character limit")
	}
	if input.Published == nil {
		return Achievement{}, errors.New("published must be a boolean")
	}
	return Achievement{Metadata: Metadata{id, now, now}, AchievementFields: f, Published: *input.Published}, nil
}

func validText(value string, maximum int, required bool) bool {
	return utf8.ValidString(value) && !strings.ContainsRune(value, '\x00') && utf8.RuneCountInString(value) <= maximum && (!required || value != "")
}
