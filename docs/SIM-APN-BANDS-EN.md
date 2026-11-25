[English](SIM-APN-BANDS-EN.md) | [한국어](SIM-APN-BANDS-KO.md) | [日本語](SIM-APN-BANDS-JA.md)

# Physical SIM, APN, and LTE/5G band setup

This guide is for a SoftBank Air 6 running its vendor firmware with a compatible Floop3 release installed. You can follow it in LuCI without SSH commands or Codex. Menu labels may vary slightly by firmware, translation, and release.

## 1. Switch to a physical SIM

1. Check the device manual for the SIM card size. Do not cut a card or force an adapter if you are unsure. Power the router off, insert the card, then power it on.
2. Open **Mobile Network → SIM/eSIM** in LuCI.
3. Under **Current SIM / SIM Mapping**, check the card type and SIM status. To use the card tray, switch to **Physical SIM (regular SIM)**. The modem radio is briefly disabled during the switch, and AT responses may stop for about 30–60 seconds. Wait for completion before starting another modem action.
4. Confirm the status shows a regular SIM and `READY`. If it requests a PIN or PUK, do not guess repeatedly; follow the carrier's instructions.
5. If a third-party SIM reports `SIM lock`, confirm your carrier and plan allow use. Follow Floop3's unlock guidance only if unlocking is required. Unlocking is separate from SIM mapping and briefly interrupts radio service.

## 2. Apply the carrier APN

After the SIM is recognized, open **Communication Settings → APN** on the SIM/eSIM page. Floop3 stores APN profiles by ICCID, so each SIM keeps its own profile.

1. Select **Read APN from SIM**. This fills the form with a carrier-provided suggestion; it does not save or apply it.
2. Compare the APN, authentication, username, and password with your carrier's instructions for your plan. If no suggestion is returned or it is incorrect, enter the values supplied by the carrier. APNs vary by carrier, plan, and SIM; do not assume a universal value.
3. Leave username/password empty and authentication set to `None` when the carrier does not require them. Use PAP/CHAP and credentials only when the carrier specifies them.
4. Select **Save and Apply**. Use **Save only** to prepare a profile for another SIM without changing the active connection.
5. Check the current WAN APN and `Applied` status. If it is `Not applied` or data does not work, check network registration, APN/authentication, and whether the plan permits data separately. An APN suggestion alone does not prove internet access.

Enable IMS only when your carrier requires it for IMS services. It is separate from the data APN and does not guarantee SMS delivery. Do not share APN credentials.

## 3. Select LTE/5G bands and verify registration

1. Open **Mobile Network → Signal/Band** in LuCI.
2. Distinguish the displayed lists:
   - **Supported bands**: capabilities reported by the modem
   - **Enabled bands**: the modem's current allowed list
   - **Serving bands**: bands currently used by the cell
3. Select only bands used by your carrier for your location and plan. If you have no reliable information, keeping all supported bands is safest. Do not clear all LTE bands. 5G NSA needs an LTE anchor band before NR can attach.
4. Select **Apply** and review the LTE/NR change in the confirmation dialog. Radio service may pause briefly. Keep your client connected to the router's management Wi-Fi/LAN so LuCI remains reachable if cellular WAN drops.
5. Floop3 waits for network registration. If the modem does not register in time, it restores the previous band settings and reports the result. Keep the page open and check the job status.
6. When complete, check the registered operator, registration status, access technology, serving bands, and WAN status. Seeing LTE with no 5G may mean NR has not been added in an NSA setup. A band listed as supported does not guarantee local coverage, carrier permission, or registration.

Floop3 can reapply the saved band selection at startup. The modem's active mask may return to its factory default after reboot, so check runtime bands and registration again after restarting.

## 4. Diagnose connection failures in order

| Screen state | Check |
|---|---|
| SIM missing/unreadable | Card orientation and fit, physical SIM mapping, SIM lock/PIN state |
| SIM `READY`, not registered | Coverage, band restrictions, plan/roaming permission, lock state |
| Registered, WAN/APN not applied | APN profile for the current ICCID, authentication, apply status |
| APN applied, no internet | Plan data permission, quota/bar, carrier IP-type requirements, WAN status |
| Not registered after a band change | Check whether automatic rollback completed. Avoid repeated combinations; restore all supported bands |

Check the failure stage and rollback result in Floop3 before trying anything else. Do not run guessed AT commands, modem factory resets, or repeated reboots. Do not share ICCID, EID, or phone number if identifier display is enabled.
