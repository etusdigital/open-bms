package main

import (
	"reflect"
	"testing"
)

func TestExtractRecipients_OnePerPersonalizationTo(t *testing.T) {
	mail := map[string]interface{}{
		"personalizations": []interface{}{
			map[string]interface{}{
				"to": []interface{}{
					map[string]interface{}{"email": "a@a.com"},
				},
				"custom_args": map[string]interface{}{"contactId": "1"},
			},
			map[string]interface{}{
				"to": []interface{}{
					map[string]interface{}{"email": "b@b.com"},
					map[string]interface{}{"email": "c@c.com"},
				},
				"custom_args": map[string]interface{}{"contactId": "2"},
			},
		},
	}

	got := extractRecipients(mail)
	if len(got) != 3 {
		t.Fatalf("expected 3 recipients, got %d", len(got))
	}
	emails := []string{got[0].email, got[1].email, got[2].email}
	want := []string{"a@a.com", "b@b.com", "c@c.com"}
	if !reflect.DeepEqual(emails, want) {
		t.Errorf("emails = %v, want %v", emails, want)
	}
	if got[0].customArgs["contactId"] != "1" {
		t.Errorf("first recipient contactId = %v, want 1", got[0].customArgs["contactId"])
	}
	if got[2].customArgs["contactId"] != "2" {
		t.Errorf("third recipient inherits second personalization custom_args, got %v", got[2].customArgs["contactId"])
	}
}

func TestExtractRecipients_EmptyOrMissing(t *testing.T) {
	cases := []map[string]interface{}{
		{},
		{"personalizations": []interface{}{}},
		{"personalizations": []interface{}{map[string]interface{}{"to": []interface{}{}}}},
	}
	for i, c := range cases {
		if got := extractRecipients(c); len(got) != 0 {
			t.Errorf("case %d: expected no recipients, got %d", i, len(got))
		}
	}
}

func TestMergeArgs_OverrideWinsAndBaseUntouched(t *testing.T) {
	base := map[string]interface{}{"accountId": "1", "shared": "base"}
	override := map[string]interface{}{"contactId": "9", "shared": "override"}

	out := mergeArgs(base, override)

	if out["accountId"] != "1" || out["contactId"] != "9" || out["shared"] != "override" {
		t.Errorf("merged = %v", out)
	}
	if base["shared"] != "base" {
		t.Errorf("mergeArgs mutated base; shared = %v", base["shared"])
	}
}
