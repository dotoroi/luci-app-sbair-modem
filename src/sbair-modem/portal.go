// SPDX-License-Identifier: MIT
// Copyright (c) 2026 syado

package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"html"
	"log"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
)

// 広告ブロックの自己登録ページ。認証は無い(自分の端末しか操作できない設計のため
// 不要と判断した)。LuCIとは独立した専用ポートで公開する。
//
// 仕組み: アクセスしてきたHTTP接続の送信元IP(r.RemoteAddr)を、clients.goと同じ
// `ip neigh` でMACに変換する。表示・操作の対象は「今アクセスしてきた本人の端末」
// だけに限定されるので、他人の端末を勝手に操作されることはない。

const (
	portalPort       = "8090"
	portalCSRFCookie = "sbair_portal_csrf"
)

var (
	portalBrlanIPFn     = brlanIP
	portalMACFromIPFn   = macFromIP
	portalAdblockSetFn  = adblockSet
	portalAdblockMACsFn = adblockMacs
	portalListenFn      = func(addr string, handler http.Handler) error { return http.ListenAndServe(addr, handler) }
	portalTokenFn       = generatePortalToken
)

func generatePortalToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// macFromIP は clients.go の clientList と同じ ip neigh を使って、
// 指定IPに対応するMACアドレスを引く。見つからなければ空文字。
func macFromIP(ip string) string {
	out, err := exec.Command("ip", "neigh", "show", "dev", "br-lan").Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Fields(line)
		if len(f) < 1 || f[0] != ip {
			continue
		}
		for i, tok := range f {
			if tok == "lladdr" && i+1 < len(f) {
				return strings.ToLower(f[i+1])
			}
		}
	}
	return ""
}

func portalRequesterMAC(r *http.Request) (mac, ip string) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return portalMACFromIPFn(host), host
}

type portalCopy struct {
	title, heading, unresolved, device, current string
	enabled, disabled, enable, disable, dnsNote string
	applied, failed, sessionFailed, badRequest  string
}

var portalLanguages = map[string]portalCopy{
	"en": {
		title: "Ad blocking", heading: "Ad blocking for this device",
		unresolved: "Could not identify the device at %s. Wait a moment and reload.",
		device:     "Your device:", current: "Current status:",
		enabled: "Enabled", disabled: "Disabled", enable: "Enable ad blocking", disable: "Disable ad blocking",
		dnsNote: "Ad blocking does not apply to apps or browsers using DNS over HTTPS or TLS.",
		applied: "Settings applied.", failed: "Could not apply the settings.",
		sessionFailed: "Could not verify this session. Reload the page and try again.", badRequest: "Invalid request.",
	},
	"ko": {
		title: "광고 차단", heading: "이 기기의 광고 차단 설정",
		unresolved: "IP 주소 %s의 기기를 식별할 수 없습니다. 잠시 후 새로고침하세요.",
		device:     "내 기기:", current: "현재 상태:",
		enabled: "켜짐", disabled: "꺼짐", enable: "광고 차단 켜기", disable: "광고 차단 끄기",
		dnsNote: "HTTPS 또는 TLS로 DNS를 사용하는 앱이나 브라우저에는 광고 차단이 적용되지 않습니다.",
		applied: "설정을 적용했습니다.", failed: "설정을 적용하지 못했습니다.",
		sessionFailed: "세션을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도하세요.", badRequest: "잘못된 요청입니다.",
	},
	"ja": {
		title: "広告ブロック", heading: "この端末の広告ブロック設定",
		unresolved: "IPアドレス %s の端末を特定できませんでした。少し待ってから再読み込みしてください。",
		device:     "あなたの端末:", current: "現在の状態:",
		enabled: "有効", disabled: "無効", enable: "広告ブロックを有効にする", disable: "広告ブロックを無効にする",
		dnsNote: "DNS over HTTPS/TLSを使うアプリやブラウザーには適用されません。",
		applied: "設定を反映しました。", failed: "設定を反映できませんでした。",
		sessionFailed: "セッションを確認できません。ページを再読み込みして再試行してください。", badRequest: "無効なリクエストです。",
	},
}

func portalLanguage(r *http.Request) string {
	if lang := r.URL.Query().Get("lang"); portalLanguages[lang].title != "" {
		return lang
	}
	best, priority := "en", 0.0
	for _, part := range strings.Split(r.Header.Get("Accept-Language"), ",") {
		tag, params, _ := strings.Cut(part, ";")
		lang, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(tag)), "-")
		if portalLanguages[lang].title == "" {
			continue
		}
		weight := 1.0
		for _, param := range strings.Split(params, ";") {
			if value, ok := strings.CutPrefix(strings.TrimSpace(param), "q="); ok {
				weight, _ = strconv.ParseFloat(value, 64)
			}
		}
		if weight > priority && weight <= 1 {
			best, priority = lang, weight
		}
	}
	return best
}

func portalPage(lang, mac, ip string, enabled bool, message, csrfToken string) string {
	copy := portalLanguages[lang]
	status := copy.disabled
	statusColor := "#888"
	toggleLabel := copy.enable
	nextVal := "1"
	if enabled {
		status = copy.enabled
		statusColor = "#5cb85c"
		toggleLabel = copy.disable
		nextVal = "0"
	}

	body := fmt.Sprintf(`<nav><a href="/?lang=en">English</a> · <a href="/?lang=ko">한국어</a> · <a href="/?lang=ja">日本語</a></nav><h2>%s</h2>`, copy.heading)
	if mac == "" {
		body += fmt.Sprintf(`<p style="color:#c00">%s</p>`, html.EscapeString(fmt.Sprintf(copy.unresolved, ip)))
	} else {
		body += fmt.Sprintf(`<p>%s <code>%s</code></p>`, copy.device, html.EscapeString(mac))
		body += fmt.Sprintf(`<p>%s <b style="color:%s">%s</b></p>`, copy.current, statusColor, status)
		body += fmt.Sprintf(`<form method="post" action="/toggle?lang=%s">
			<input type="hidden" name="enabled" value="%s">
			<input type="hidden" name="csrf_token" value="%s">
			<button type="submit" style="font-size:1.1em;padding:.6em 1.2em;">%s</button>
	</form>`, lang, nextVal, html.EscapeString(csrfToken), toggleLabel)
		body += fmt.Sprintf(`<p style="opacity:.7;margin-top:1em">%s</p>`, copy.dnsNote)
	}
	if message != "" {
		body += fmt.Sprintf(`<p style="color:#5cb85c">%s</p>`, message)
	}

	return fmt.Sprintf(`<!doctype html><html lang="%s"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title>
<style>body{font-family:sans-serif;max-width:32em;margin:2em auto;padding:0 1em}
code{background:#eee;padding:.1em .4em;border-radius:.2em}</style>
</head><body>%s</body></html>`, lang, copy.title, body)
}

func portalHandler(w http.ResponseWriter, r *http.Request) {
	lang := portalLanguage(r)
	copy := portalLanguages[lang]
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Language", lang)
	w.Header().Set("Vary", "Accept-Language")
	if r.URL.Path != "/" && r.URL.Path != "/toggle" {
		http.NotFound(w, r)
		return
	}
	if (r.URL.Path == "/" && r.Method != http.MethodGet) ||
		(r.URL.Path == "/toggle" && r.Method != http.MethodPost) {
		w.Header().Set("Allow", map[bool]string{true: http.MethodGet, false: http.MethodPost}[r.URL.Path == "/"])
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	mac, ip := portalRequesterMAC(r)
	message := ""

	if r.Method == http.MethodGet {
		cookie, err := r.Cookie(portalCSRFCookie)
		if err != nil || cookie.Value == "" {
			token, err := portalTokenFn()
			if err != nil {
				http.Error(w, copy.sessionFailed, http.StatusInternalServerError)
				return
			}
			cookie = &http.Cookie{
				Name:     portalCSRFCookie,
				Value:    token,
				Path:     "/",
				HttpOnly: true,
				SameSite: http.SameSiteStrictMode,
				Secure:   false,
			}
			http.SetCookie(w, cookie)
		}
		csrfToken := cookie.Value
		enabled := mac != "" && portalAdblockMACsFn()[mac]
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = fmt.Fprint(w, portalPage(lang, mac, ip, enabled, "", csrfToken))
		return
	}

	csrfCookie, err := r.Cookie(portalCSRFCookie)
	if err != nil || csrfCookie.Value == "" {
		http.Error(w, copy.sessionFailed, http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, copy.badRequest, http.StatusBadRequest)
		return
	}
	formToken := r.Form.Get("csrf_token")
	if formToken == "" || len(formToken) != len(csrfCookie.Value) ||
		subtle.ConstantTimeCompare([]byte(formToken), []byte(csrfCookie.Value)) != 1 {
		http.Error(w, copy.sessionFailed, http.StatusForbidden)
		return
	}
	if enabledValue := r.Form.Get("enabled"); enabledValue != "0" && enabledValue != "1" {
		http.Error(w, copy.badRequest, http.StatusBadRequest)
		return
	}

	if r.Method == http.MethodPost && r.URL.Path == "/toggle" {
		if mac == "" {
			http.Error(w, fmt.Sprintf(copy.unresolved, ip), http.StatusServiceUnavailable)
			return
		}
		res := portalAdblockSetFn(mac, r.Form.Get("enabled"))
		if e, ok := res["error"]; ok {
			log.Printf("sbair-portal: applying adblock setting: %v", e)
			message = copy.failed
		} else {
			message = copy.applied
		}
	}

	enabled := mac != "" && portalAdblockMACsFn()[mac]
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprint(w, portalPage(lang, mac, ip, enabled, message, csrfCookie.Value))
}

func runPortal() int {
	ip := portalBrlanIPFn()
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.To4() == nil {
		log.Printf("sbair-portal: br-lan IPv4 address is unavailable")
		return 1
	}
	addr := net.JoinHostPort(parsed.To4().String(), portalPort)
	mux := http.NewServeMux()
	mux.HandleFunc("/", portalHandler)
	log.Printf("sbair-portal listening on %s", addr)
	if err := portalListenFn(addr, mux); err != nil {
		log.Printf("sbair-portal: %v", err)
		return 1
	}
	return 0
}
