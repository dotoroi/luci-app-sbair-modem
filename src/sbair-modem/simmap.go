// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912

package main

import (
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// SIM マッピングの切替。

func startSimmap(target int) map[string]any {
	if target != 1 && target != 2 {
		return map[string]any{"error": "SIM mapping must be 1 (physical slot) or 2 (built-in eSIM)."}
	}
	out := startJob("simmap", fmt.Sprint(target))
	if _, bad := out["error"]; !bad {
		out["target"] = target
		out["note"] = "Switching takes 30–60 seconds. AT commands will not respond during this time."
	}
	return out
}

// runSimmapWorker performs the switch. It runs detached, so nothing reads its
// stdout - progress goes to the state file.
func runSimmapWorker(target int) int {
	j := newJob("simmap")
	j.state.Target = target
	j.write()

	ch := NewATChannel(*device)
	ch.SetTimeout(30 * time.Second)
	if err := ch.Connect(); err != nil {
		return j.fail("Connect", err.Error())
	}
	defer ch.Disconnect()

	// 開きっぱなしの論理チャネルを持ったまま切り替えない。
	ch.CloseAllChannels()

	j.step("Disable radio (AT+CFUN=4)")
	if _, err := ch.Command("AT+CFUN=4"); err != nil {
		return j.fail("AT+CFUN=4", err.Error())
	}
	time.Sleep(5 * time.Second)

	if target == 1 {
		j.step("Switch to physical slot (/bin/usim)")
		// ベンダ純正。CFUN=4 を前提に esimmap=1 と esimtray=1 を打つ。
		// AT は使わないので、こちらの接続とは競合しない。
		out, err := exec.Command("/bin/usim").CombinedOutput()
		if err != nil {
			return j.fail("/bin/usim", fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))))
		}
	} else {
		j.step("Switch to built-in eSIM (AT+ESIMMAP=2)")
		// +CNVRM: 0 を返してから OK。プレフィクスで拾わない限り紛れる。
		if _, err := ch.Command("AT+ESIMMAP=2"); err != nil {
			return j.fail("AT+ESIMMAP=2", err.Error())
		}
	}

	j.step("Wait for modem reinitialization (25 seconds)")
	time.Sleep(25 * time.Second)

	j.step("Restore radio (AT+CFUN=1)")
	// ここは失敗しても致命ではない。再初期化中で一度弾かれることがある。
	if _, err := ch.Command("AT+CFUN=1"); err != nil {
		time.Sleep(10 * time.Second)
		_, _ = ch.Command("AT+CFUN=1")
	}

	j.step("Verify recovery")
	// **確認できるまで諦めない。** 切替直後は AT が空応答を返す時間帯がある。
	for i := 0; i < 12; i++ {
		time.Sleep(5 * time.Second)
		lines, err := ch.Command("AT+ESIMMAP?")
		if err != nil {
			continue
		}
		v, ok := First(lines, "+ESIMMAP:")
		if !ok {
			continue
		}
		var n int
		fmt.Sscanf(v, "%d", &n)
		j.state.Mapping = n
		if n == target {
			msg := ""
			if pin, err := ch.Command("AT+CPIN?"); err == nil {
				if p, ok := First(pin, "+CPIN:"); ok {
					msg = "SIM: " + p
				}
			}
			return j.done("Complete", msg)
		}
	}

	if j.state.Mapping != 0 && j.state.Mapping != target {
		// /bin/usim は物理スロットで読めるカードが無いと内蔵 eSIM に落ちる。
		// 「失敗」ではなく「そう落ちた」と伝える方が原因に近い。
		return j.fail("Recovery verification",
			fmt.Sprintf("The mapping did not change (current: %d). If the physical-slot card cannot be read, the modem falls back to the built-in eSIM.", j.state.Mapping))
	}
	return j.fail("Recovery verification", "The modem did not respond after switching. Check it over serial.")
}
