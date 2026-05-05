// SendGrid API mock for BMS local/CI testing.
//
// Implements only the 14 v3 routes the BMS monorepo actually calls, plus 3
// admin endpoints (/__mock/...) for test orchestration. State is in-memory;
// /__mock/reset clears it. On POST /v3/mail/send the mock schedules a
// processed → delivered → open → click event burst against the registered
// event webhook URL so the receiving leg can be exercised end-to-end.
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type webhook struct {
	ID                string `json:"id"`
	Enabled           bool   `json:"enabled"`
	URL               string `json:"url"`
	FriendlyName      string `json:"friendly_name,omitempty"`
	Bounce            bool   `json:"bounce"`
	Click             bool   `json:"click"`
	Deferred          bool   `json:"deferred"`
	Delivered         bool   `json:"delivered"`
	Dropped           bool   `json:"dropped"`
	GroupResubscribe  bool   `json:"group_resubscribe"`
	GroupUnsubscribe  bool   `json:"group_unsubscribe"`
	Open              bool   `json:"open"`
	Processed         bool   `json:"processed"`
	SpamReport        bool   `json:"spam_report"`
	Unsubscribe       bool   `json:"unsubscribe"`
	CreatedDate       string `json:"created_date"`
	UpdatedDate       string `json:"updated_date"`
}

type singleSend struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name,omitempty"`
	Status     string                 `json:"status"`
	SendAt     string                 `json:"send_at,omitempty"`
	Raw        map[string]interface{} `json:"-"`
}

type mailRecord struct {
	ReceivedAt time.Time              `json:"received_at"`
	Body       map[string]interface{} `json:"body"`
}

type firedEvent struct {
	FiredAt time.Time              `json:"fired_at"`
	Target  string                 `json:"target"`
	Status  int                    `json:"status"`
	Payload map[string]interface{} `json:"payload"`
}

type store struct {
	mu          sync.Mutex
	webhooks    []webhook
	singleSends map[string]singleSend
	mails       []mailRecord
	fired       []firedEvent
}

var (
	st          = &store{singleSends: map[string]singleSend{}}
	httpClient  = &http.Client{Timeout: 5 * time.Second}
	eventDelay  = parseDelay(os.Getenv("MOCK_EVENT_DELAY_MS"), 500)
	maxWebhooks = 2
)

func parseDelay(raw string, def int) time.Duration {
	if raw == "" {
		return time.Duration(def) * time.Millisecond
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return time.Duration(def) * time.Millisecond
	}
	return time.Duration(n) * time.Millisecond
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]))
}

func today() string { return time.Now().UTC().Format("2006-01-02") }

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func readJSON(r *http.Request, into interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(into)
}

// --- SendGrid v3 routes ---

// GET /v3/user/account — used by sendgrid-validator.ts
func handleUserAccount(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"type":       "free",
		"reputation": 99.7,
		"first_name": "BMS",
		"last_name":  "Mock",
		"company":    "BMS Mock SendGrid",
	})
}

// GET /v3/user/webhooks/event/settings/all
func handleWebhooksList(w http.ResponseWriter, _ *http.Request) {
	st.mu.Lock()
	defer st.mu.Unlock()
	writeJSON(w, 200, map[string]interface{}{
		"max_allowed": maxWebhooks,
		"webhooks":    st.webhooks,
	})
}

// POST /v3/user/webhooks/event/settings
func handleWebhookCreate(w http.ResponseWriter, r *http.Request) {
	var wh webhook
	if err := readJSON(r, &wh); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	if len(st.webhooks) >= maxWebhooks {
		writeJSON(w, 400, map[string]interface{}{
			"errors": []map[string]string{{"message": "max_allowed webhooks already registered"}},
		})
		return
	}
	wh.ID = newID()
	wh.CreatedDate = today()
	wh.UpdatedDate = today()
	st.webhooks = append(st.webhooks, wh)
	writeJSON(w, 201, wh)
}

// PATCH /v3/user/webhooks/event/settings/{id}
func handleWebhookUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var patch webhook
	if err := readJSON(r, &patch); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	for i, wh := range st.webhooks {
		if wh.ID == id {
			patch.ID = id
			patch.CreatedDate = wh.CreatedDate
			patch.UpdatedDate = today()
			st.webhooks[i] = patch
			writeJSON(w, 200, patch)
			return
		}
	}
	writeJSON(w, 404, map[string]string{"error": "webhook not found"})
}

// GET /v3/send_ips/pools — handler.ts:138 expects { result: [...] }
func handlePools(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"result": []map[string]interface{}{
			{"name": "mock-pool-1", "ips": []string{}},
		},
	})
}

// GET /v3/ips
func handleIPs(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, []map[string]interface{}{
		{"ip": "203.0.113.1", "pools": []string{"mock-pool-1"}, "warmup": false, "start_date": today()},
	})
}

// GET /v3/categories/stats
func handleCategoryStats(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, []map[string]interface{}{
		{
			"date": today(),
			"stats": []map[string]interface{}{
				{"type": "category", "name": "mock", "metrics": map[string]int{
					"requests": 0, "delivered": 0, "opens": 0, "clicks": 0, "bounces": 0,
				}},
			},
		},
	})
}

// POST /v3/marketing/singlesends
func handleSingleSendCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	id := newID()
	ss := singleSend{ID: id, Status: "draft", Raw: body}
	if name, ok := body["name"].(string); ok {
		ss.Name = name
	}
	st.mu.Lock()
	st.singleSends[id] = ss
	st.mu.Unlock()
	writeJSON(w, 201, map[string]interface{}{"id": id, "name": ss.Name, "status": ss.Status})
}

// PUT /v3/marketing/singlesends/{id}/schedule
func handleSingleSendSchedule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]interface{}
	_ = readJSON(r, &body)
	st.mu.Lock()
	ss, ok := st.singleSends[id]
	if !ok {
		st.mu.Unlock()
		writeJSON(w, 404, map[string]string{"error": "single send not found"})
		return
	}
	if v, ok := body["send_at"].(string); ok {
		ss.SendAt = v
	}
	ss.Status = "scheduled"
	st.singleSends[id] = ss
	st.mu.Unlock()
	writeJSON(w, 200, map[string]interface{}{"id": id, "send_at": ss.SendAt, "status": ss.Status})
}

// GET /v3/marketing/singlesends/{id}
func handleSingleSendGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st.mu.Lock()
	defer st.mu.Unlock()
	ss, ok := st.singleSends[id]
	if !ok {
		writeJSON(w, 404, map[string]string{"error": "single send not found"})
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"id":      ss.ID,
		"name":    ss.Name,
		"status":  ss.Status,
		"send_at": ss.SendAt,
	})
}

// DELETE /v3/marketing/singlesends/{id}/schedule
func handleSingleSendUnschedule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	st.mu.Lock()
	defer st.mu.Unlock()
	ss, ok := st.singleSends[id]
	if !ok {
		writeJSON(w, 404, map[string]string{"error": "single send not found"})
		return
	}
	ss.Status = "draft"
	ss.SendAt = ""
	st.singleSends[id] = ss
	writeJSON(w, 204, nil)
}

// PATCH /v3/marketing/singlesends/{id}
func handleSingleSendUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]interface{}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	ss, ok := st.singleSends[id]
	if !ok {
		writeJSON(w, 404, map[string]string{"error": "single send not found"})
		return
	}
	if name, ok := body["name"].(string); ok {
		ss.Name = name
	}
	if sendAt, ok := body["send_at"].(string); ok {
		ss.SendAt = sendAt
	}
	ss.Raw = body
	st.singleSends[id] = ss
	writeJSON(w, 200, map[string]interface{}{"id": id, "name": ss.Name, "status": ss.Status})
}

// GET /v3/verified_senders
func handleVerifiedSenders(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"results": []map[string]interface{}{
			{
				"id":         1,
				"from_email": "mock@bms.local",
				"from_name":  "BMS Mock Sender",
				"verified":   true,
			},
		},
	})
}

// POST /v3/mail/send — accept and schedule synthetic events.
func handleMailSend(w http.ResponseWriter, r *http.Request) {
	bodyBytes, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	var body map[string]interface{}
	_ = json.Unmarshal(bodyBytes, &body)

	st.mu.Lock()
	st.mails = append(st.mails, mailRecord{ReceivedAt: time.Now(), Body: body})
	webhooks := append([]webhook(nil), st.webhooks...)
	st.mu.Unlock()

	go scheduleEventBurst(webhooks, body)

	w.Header().Set("X-Message-Id", newID())
	w.WriteHeader(202)
}

func scheduleEventBurst(webhooks []webhook, mail map[string]interface{}) {
	if len(webhooks) == 0 {
		log.Println("[mock] mail/send received but no webhook registered — events not fired")
		return
	}
	email := extractFirstRecipient(mail)
	categories := extractCategories(mail)
	msgID := newID()

	burst := []string{"processed", "delivered", "open", "click"}
	for i, evt := range burst {
		evt := evt
		i := i
		time.AfterFunc(time.Duration(i+1)*eventDelay, func() {
			payload := buildEvent(evt, email, categories, msgID)
			for _, wh := range webhooks {
				if !eventEnabled(wh, evt) {
					continue
				}
				fire(wh.URL, payload)
			}
		})
	}
}

func extractFirstRecipient(mail map[string]interface{}) string {
	personalizations, ok := mail["personalizations"].([]interface{})
	if !ok || len(personalizations) == 0 {
		return "recipient@bms.local"
	}
	first, ok := personalizations[0].(map[string]interface{})
	if !ok {
		return "recipient@bms.local"
	}
	to, ok := first["to"].([]interface{})
	if !ok || len(to) == 0 {
		return "recipient@bms.local"
	}
	addr, ok := to[0].(map[string]interface{})
	if !ok {
		return "recipient@bms.local"
	}
	if e, ok := addr["email"].(string); ok {
		return e
	}
	return "recipient@bms.local"
}

func extractCategories(mail map[string]interface{}) []string {
	raw, ok := mail["categories"].([]interface{})
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(raw))
	for _, c := range raw {
		if s, ok := c.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func buildEvent(eventType, email string, categories []string, sgMessageID string) map[string]interface{} {
	now := time.Now().Unix()
	base := map[string]interface{}{
		"email":         email,
		"timestamp":     now,
		"event":         eventType,
		"sg_event_id":   newID(),
		"sg_message_id": sgMessageID,
		"category":      categories,
	}
	switch eventType {
	case "processed":
		base["smtp-id"] = "<mock-" + sgMessageID + "@bms.local>"
	case "delivered":
		base["response"] = "250 OK"
	case "deferred":
		base["response"] = "400 try again later"
		base["attempt"] = "1"
	case "bounce":
		base["bounce_classification"] = "Invalid Address"
		base["reason"] = "550 5.1.1 The email account that you tried to reach does not exist"
		base["status"] = "5.1.1"
		base["type"] = "bounce"
	case "dropped":
		base["reason"] = "Bounced Address"
		base["status"] = "5.0.0"
	case "open":
		base["useragent"] = "Mozilla/5.0 (BMS Mock)"
		base["ip"] = "203.0.113.10"
		base["sg_machine_open"] = false
	case "click":
		base["url"] = "https://example.com/mock-link"
		base["url_offset"] = map[string]interface{}{"index": 0, "type": "html"}
		base["useragent"] = "Mozilla/5.0 (BMS Mock)"
		base["ip"] = "203.0.113.10"
	case "spamreport", "unsubscribe":
		// no extra required fields
	case "group_unsubscribe", "group_resubscribe":
		base["asm_group_id"] = 1
	}
	return base
}

func eventEnabled(wh webhook, evt string) bool {
	if !wh.Enabled {
		return false
	}
	switch evt {
	case "processed":
		return wh.Processed
	case "delivered":
		return wh.Delivered
	case "deferred":
		return wh.Deferred
	case "bounce":
		return wh.Bounce
	case "dropped":
		return wh.Dropped
	case "open":
		return wh.Open
	case "click":
		return wh.Click
	case "spamreport":
		return wh.SpamReport
	case "unsubscribe":
		return wh.Unsubscribe
	case "group_unsubscribe":
		return wh.GroupUnsubscribe
	case "group_resubscribe":
		return wh.GroupResubscribe
	}
	return false
}

func fire(target string, payload map[string]interface{}) {
	body := []map[string]interface{}{payload}
	buf, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", target, bytes.NewReader(buf))
	if err != nil {
		log.Printf("[mock] fire build req err: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SendGrid Event API (BMS Mock)")
	resp, err := httpClient.Do(req)
	status := 0
	if err != nil {
		log.Printf("[mock] fire %s err: %v", target, err)
	} else {
		status = resp.StatusCode
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}
	st.mu.Lock()
	st.fired = append(st.fired, firedEvent{FiredAt: time.Now(), Target: target, Status: status, Payload: payload})
	st.mu.Unlock()
}

// --- /__mock admin routes ---

// POST /__mock/fire — body { "events": [<sendgrid event>...], "target": "<override webhook url>"? }
func handleMockFire(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []map[string]interface{} `json:"events"`
		Target string                   `json:"target,omitempty"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	if len(body.Events) == 0 {
		writeJSON(w, 400, map[string]string{"error": "events[] required"})
		return
	}
	st.mu.Lock()
	webhooks := append([]webhook(nil), st.webhooks...)
	st.mu.Unlock()

	targets := []string{}
	if body.Target != "" {
		targets = append(targets, body.Target)
	} else {
		for _, wh := range webhooks {
			targets = append(targets, wh.URL)
		}
	}
	if len(targets) == 0 {
		writeJSON(w, 409, map[string]string{"error": "no webhook registered and no target override"})
		return
	}
	// Fire as a single batch (matches real SendGrid behavior: one POST with array of events).
	for _, t := range targets {
		go fireBatch(t, body.Events)
	}
	writeJSON(w, 202, map[string]interface{}{"queued": len(body.Events), "targets": targets})
}

func fireBatch(target string, events []map[string]interface{}) {
	buf, _ := json.Marshal(events)
	req, err := http.NewRequest("POST", target, bytes.NewReader(buf))
	if err != nil {
		log.Printf("[mock] fireBatch req err: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SendGrid Event API (BMS Mock)")
	resp, err := httpClient.Do(req)
	status := 0
	if err != nil {
		log.Printf("[mock] fireBatch %s err: %v", target, err)
	} else {
		status = resp.StatusCode
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}
	st.mu.Lock()
	for _, p := range events {
		st.fired = append(st.fired, firedEvent{FiredAt: time.Now(), Target: target, Status: status, Payload: p})
	}
	st.mu.Unlock()
}

// GET /__mock/state
func handleMockState(w http.ResponseWriter, _ *http.Request) {
	st.mu.Lock()
	defer st.mu.Unlock()
	writeJSON(w, 200, map[string]interface{}{
		"webhooks":     st.webhooks,
		"single_sends": st.singleSends,
		"mails":        st.mails,
		"fired":        st.fired,
	})
}

// POST /__mock/reset
func handleMockReset(w http.ResponseWriter, _ *http.Request) {
	st.mu.Lock()
	st.webhooks = nil
	st.singleSends = map[string]singleSend{}
	st.mails = nil
	st.fired = nil
	st.mu.Unlock()
	writeJSON(w, 204, nil)
}

func main() {
	mux := http.NewServeMux()

	// SendGrid v3
	mux.HandleFunc("GET /v3/user/account", handleUserAccount)
	mux.HandleFunc("GET /v3/user/webhooks/event/settings/all", handleWebhooksList)
	mux.HandleFunc("POST /v3/user/webhooks/event/settings", handleWebhookCreate)
	mux.HandleFunc("PATCH /v3/user/webhooks/event/settings/{id}", handleWebhookUpdate)
	mux.HandleFunc("GET /v3/send_ips/pools", handlePools)
	mux.HandleFunc("GET /v3/ips", handleIPs)
	mux.HandleFunc("GET /v3/categories/stats", handleCategoryStats)
	mux.HandleFunc("POST /v3/marketing/singlesends", handleSingleSendCreate)
	mux.HandleFunc("PUT /v3/marketing/singlesends/{id}/schedule", handleSingleSendSchedule)
	mux.HandleFunc("GET /v3/marketing/singlesends/{id}", handleSingleSendGet)
	mux.HandleFunc("DELETE /v3/marketing/singlesends/{id}/schedule", handleSingleSendUnschedule)
	mux.HandleFunc("PATCH /v3/marketing/singlesends/{id}", handleSingleSendUpdate)
	mux.HandleFunc("GET /v3/verified_senders", handleVerifiedSenders)
	mux.HandleFunc("POST /v3/mail/send", handleMailSend)

	// Admin
	mux.HandleFunc("POST /__mock/fire", handleMockFire)
	mux.HandleFunc("GET /__mock/state", handleMockState)
	mux.HandleFunc("POST /__mock/reset", handleMockReset)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})

	addr := ":" + envOr("PORT", "3010")
	log.Printf("[sendgrid-mock] listening on %s, event_delay=%s", addr, eventDelay)
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
