// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912

package main

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/damonto/euicc-go/lpa"
	sgp22 "github.com/damonto/euicc-go/v2"
)

// ES9+ — profile のダウンロード(eSIM のインストール)。

func startDownload(code, cc string) map[string]any {
	code = strings.TrimSpace(code)
	if code == "" {
		return map[string]any{"error": "Enter the activation code."}
	}
	if _, err := parseActivationCode(code); err != nil {
		return map[string]any{"error": err.Error()}
	}
	out := startJob("download", code, cc)
	if _, bad := out["error"]; !bad {
		out["note"] = "This takes 20–30 seconds. Wait for communication with SM-DP+ to finish."
	}
	return out
}

// runDownloadWorker installs one profile. Detached, so progress goes to the
// state file rather than stdout.
func runDownloadWorker(code, cc string) int {
	j := newJob("download")
	j.write()

	ac, err := parseActivationCode(code)
	if err != nil {
		return j.fail("Activation code", err.Error())
	}
	if cc != "" {
		ac.ConfirmationCode = cc
	}

	ch := NewATChannel(*device)
	ch.SetTimeout(120 * time.Second)
	if err := ch.Connect(); err != nil {
		return j.fail("Connect", err.Error())
	}
	defer ch.Disconnect()

	j.step("Open eUICC")
	kind, _, _, aid := inspectCard(ch)
	if kind != cardEUICC {
		return j.fail("Open eUICC",
			"No eUICC is available. Switch to an eUICC card in the physical slot.")
	}
	client, err := openEUICC(ch, aid)
	if err != nil {
		return j.fail("Open eUICC", err.Error())
	}
	// os.Exit は defer を飛ばすので、返る前に必ず閉じる。
	closed := false
	release := func() {
		if !closed {
			client.Close()
			closed = true
		}
	}
	defer release()

	// **SM-DP+ は IMEI を要求する。** モデムが知っているものを使う。
	j.step("Read IMEI")
	if ac.IMEI = *imei; ac.IMEI == "" {
		v, err := ch.IMEI()
		if err != nil {
			release()
			return j.fail("IMEI", fmt.Sprintf("Unable to read from the modem: %v", err))
		}
		ac.IMEI = v
	}

	j.step("Contact SM-DP+")
	opts := &lpa.DownloadOptions{
		OnProgress: func(s lpa.DownloadStage) {
			// **string(s) と書かないこと。** DownloadStage は uint8 で、
			// string() はルーン変換になり "\x01" が出る。String() を通す。
			j.state.Stages = append(j.state.Stages, s.String())
			j.step(stageLabel(s.String()))
		},
		// ここまで来たら利用者はダウンロードを求めている。問い直さない。
		OnConfirm:               func(*sgp22.ProfileInfo) bool { return true },
		OnEnterConfirmationCode: func() string { return cc },
	}
	if _, err := client.DownloadProfile(context.Background(), ac, opts); err != nil {
		release()
		return j.fail("Download", err.Error())
	}
	release()
	return j.done("Complete", "Profile added. Activate it from the profile list.")
}

// stageLabel turns euicc-go's stage names into something a screen can show.
func stageLabel(s string) string {
	switch s {
	case "Authenticating Client":
		return "Authenticate eUICC"
	case "Authenticating Server":
		return "Authenticate SM-DP+"
	case "Installing":
		return "Install profile"
	}
	return s
}

// parseActivationCode accepts "LPA:1$smdp$matchingid[$oid][$cc]" and also a
// bare "smdp$matchingid", which is what people usually paste.
func parseActivationCode(s string) (*lpa.ActivationCode, error) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(strings.TrimPrefix(s, "LPA:"), "1$")
	parts := strings.Split(s, "$")
	if len(parts) < 1 || parts[0] == "" {
		return nil, fmt.Errorf("Activation code does not contain an SM-DP+ address.")
	}
	ac := &lpa.ActivationCode{SMDP: &url.URL{Scheme: "https", Host: parts[0]}}
	if len(parts) > 1 {
		ac.MatchingID = parts[1]
	}
	if len(parts) > 2 {
		ac.OID = parts[2]
	}
	if len(parts) > 3 && parts[3] != "" {
		ac.ConfirmationCode = parts[3]
	}
	return ac, nil
}
