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

func TestBuildBurstForRecipient(t *testing.T) {
	t.Run("default rates produce happy path", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{open: 1, click: 1})
		want := []string{"processed", "delivered", "open", "click"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("dropped=1 short-circuits to dropped only", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{dropped: 1, open: 1, click: 1})
		want := []string{"processed", "dropped"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("bounce=1 prevents delivered and follow-ups", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{bounce: 1, open: 1, click: 1, spamReport: 1, unsubscribe: 1})
		want := []string{"processed", "bounce"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("deferred=1 prevents delivered and follow-ups", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{deferred: 1, click: 1})
		want := []string{"processed", "deferred"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("dropped wins over bounce when both 1 (priority order)", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{dropped: 1, bounce: 1, deferred: 1})
		want := []string{"processed", "dropped"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("zero-rate produces only processed + delivered (no opens)", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{})
		want := []string{"processed", "delivered"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("click cannot fire without open", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{click: 1}) // open default 0
		want := []string{"processed", "delivered"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v (click leaked without open), want %v", got, want)
		}
	})

	t.Run("delivered branch can carry spamreport + unsubscribe", func(t *testing.T) {
		got := buildBurstForRecipient(simulationRates{open: 1, click: 1, spamReport: 1, unsubscribe: 1})
		want := []string{"processed", "delivered", "open", "click", "spamreport", "unsubscribe"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})
}

func TestParseRate(t *testing.T) {
	cases := []struct {
		raw  string
		def  float64
		want float64
	}{
		{"", 0.5, 0.5},
		{"0", 0.5, 0},
		{"1", 0, 1},
		{"0.25", 0, 0.25},
		{"-1", 0.7, 0.7},  // out of range, fall back
		{"1.5", 0.7, 0.7}, // out of range, fall back
		{"junk", 0.4, 0.4},
	}
	for _, c := range cases {
		if got := parseRate(c.raw, c.def); got != c.want {
			t.Errorf("parseRate(%q, %v) = %v, want %v", c.raw, c.def, got, c.want)
		}
	}
}

func TestRollDie_Edges(t *testing.T) {
	for i := 0; i < 50; i++ {
		if rollDie(0) {
			t.Fatal("rollDie(0) returned true")
		}
		if !rollDie(1) {
			t.Fatal("rollDie(1) returned false")
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
