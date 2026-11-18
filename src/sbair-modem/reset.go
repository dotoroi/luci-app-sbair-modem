// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912

package main

import (
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// モデムのリセット — 電波を落として上げ直し、WAN を張り直す。

const (
	resetSettle  = 5 * time.Second  // CFUN=0 のあと置く時間
	resetPoll    = 3 * time.Second  // 登録を見に行く間隔
	resetPollMax = 60 * time.Second // 登録を待つ上限
)

func startModemReset() map[string]any {
	out := startJob("reset", "go")
	if _, bad := out["error"]; !bad {
		out["note"] = "This takes 30–60 seconds. The radio will restart and the WAN connection will be re-established."
	}
	return out
}

func runResetWorker() int {
	j := newJob("reset")
	j.write()

	// WAN を先に落とす。**上げたまま CFUN を往復させると netifd が
	// その間に失敗を積み、リセットの意味が消える。**
	j.step("Stop WAN")
	_, _ = exec.Command("ifdown", "wan").CombinedOutput()
	_, _ = exec.Command("ql_datacall", "--data_call_deact", "1").CombinedOutput()

	ch := NewATChannel(*device)
	ch.SetTimeout(30 * time.Second)
	if err := ch.Connect(); err != nil {
		return j.fail("Connect", err.Error())
	}

	j.step("Disable radio (AT+CFUN=0)")
	if _, err := ch.Command("AT+CFUN=0"); err != nil {
		ch.Disconnect()
		return j.fail("AT+CFUN=0", err.Error())
	}
	time.Sleep(resetSettle)

	j.step("Restore radio (AT+CFUN=1)")
	if _, err := ch.Command("AT+CFUN=1"); err != nil {
		// 一度で通らないことがある。simlock 側と同じ扱いで一度だけ粘る。
		time.Sleep(10 * time.Second)
		if _, err2 := ch.Command("AT+CFUN=1"); err2 != nil {
			ch.Disconnect()
			return j.fail("AT+CFUN=1", err2.Error())
		}
	}

	j.step("Wait for network registration")
	registered := false
	for waited := time.Duration(0); waited < resetPollMax; waited += resetPoll {
		time.Sleep(resetPoll)
		lines, err := ch.Command("AT+CEREG?")
		if err != nil {
			continue
		}
		// **`Last` で取る。** `+CEREG` の URC は `<n>` を持たないので、
		// 読み取り応答と混ざると桁がずれる。
		v, ok := Last(lines, "+CEREG:")
		if !ok {
			continue
		}
		f := splitAT(v)
		// 読み取り応答は <n>,<stat>,… 。1 = 登録済み / 5 = ローミング。
		if len(f) >= 2 && (f[1] == "1" || f[1] == "5") {
			registered = true
			break
		}
	}
	ch.Disconnect() // ifup の先で ql_datacall が AT を使う。握ったままにしない。

	if !registered {
		// **ここで諦めない。** ネットワークにつながっていなくても WAN を戻しておかないと、
		// 「リセットしたら余計に繋がらなくなった」状態で放置される。
		_, _ = ifupWAN()
		if cellularWANAllowed() {
			return j.fail("Registration", "The radio is back, but the network did not connect in time. WAN is up.")
		}
		return j.fail("Registration", "The radio is back, but network registration did not complete in time. WAN was not started in AP mode.")
	}

	j.step("Check WAN status")
	if out, err := ifupWAN(); err != nil {
		return j.fail("ifup wan", fmt.Sprintf("%v: %s", err, strings.TrimSpace(string(out))))
	}
	if !cellularWANAllowed() {
		return j.done("Complete", "The modem was reset. WAN was not started in AP mode.")
	}
	return j.done("Complete", "The modem was reset and WAN was re-established. Connection may take 10–30 seconds.")
}
