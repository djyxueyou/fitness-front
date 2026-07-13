# FitForge Profile And Training Hub Design QA

- Source visual truth: `/Users/zengyang/.codex/generated_images/019f4f22-031d-7052-b0d2-8555e316d990/exec-c47cb5c1-a160-4705-bcf9-46d85d21b32a.png`
- Implementation: `http://localhost:5173/`
- Viewport: `390 × 844`
- State: H5 visitor state; training plan view rendered, authenticated profile/calendar/history states unavailable.
- Browser evidence: in-app Browser capture of `#/pages/plan/index` on 2026-07-11.

## Full-view comparison evidence

The unauthenticated training view renders the intended four-item Tab Bar, the peer-level 计划 / 日历 / 历史 control, the current plan summary, and peer-level 我的计划 / 我的模板 rows. The visual hierarchy uses the existing FitForge tokens and avoids nested cards for the new asset group.

The selected source visual is an authenticated “我的” state. The implementation redirects an unauthenticated browser to the login screen, so the same-state profile capture required for a valid full-view comparison is not yet available.

## Focused-region comparison evidence

Focused comparison is blocked for the profile summary, grouped rows, typography, spacing, and icon treatment because the authenticated route cannot be captured without the user completing login. Code inspection and successful builds are not accepted as substitutes for rendered evidence.

## Findings

- [P1] Authenticated profile fidelity cannot be verified.
  - Location: `src/pages/profile/index.vue`
  - Evidence: the source is an authenticated profile; the browser reaches `/pages/auth/login`.
  - Impact: layout, copy wrapping, theme contrast, and interaction fidelity cannot receive a passing visual QA decision.
  - Fix: complete login in the in-app Browser, then capture “我的” at 390 × 844 and compare it with the source visual.

- [P2] Authenticated calendar/history interaction remains unverified.
  - Location: `src/pages/plan/index.vue` and `src/components/training-hub/records-view.vue`
  - Evidence: visitor clicks correctly require authentication, preventing rendered verification of month navigation, filters, pagination, and record detail links.
  - Impact: the core structure builds successfully, but authenticated runtime behavior still needs proof.
  - Fix: after login, exercise 计划 → 日历 → 历史 and confirm each view renders and scrolls without nested controls.

## Comparison history

- Iteration 1: training visitor state showed the renamed Tab, three peer views, and peer-level plan/template assets. Build and TypeScript checks passed.
- Iteration 1 fix: record views were changed from nested full-height scroll containers to content views using the training page scroll; history pagination now has an explicit “点击加载更多” action.
- Post-fix evidence: H5 and WeChat Mini Program builds pass. Authenticated visual evidence is still blocked.
- Iteration 2: user comparison showed the profile still contained a separate level card and two titled groups, while the selected visual uses one compact summary and one unified menu group. The training page also repeated “我的计划” in both the asset group and plan selector.
- Iteration 2 fix: the profile now contains only identity/level metadata plus three statistics in one summary, followed by one six-row menu group. The duplicated training asset group was removed; “我的模板” is rendered only beneath the selector when “我的计划” is active.
- Post-fix evidence: the visitor training capture no longer contains “我的训练资产” or a duplicate “我的计划” row. TypeScript, H5, and WeChat Mini Program builds pass. Authenticated profile and “我的计划” captures remain blocked on login.

## Required fidelity surfaces

- Fonts and typography: blocked for same-state profile comparison.
- Spacing and layout rhythm: training visitor view checked; profile blocked.
- Colors and visual tokens: training visitor view uses existing theme variables; authenticated light/dark profile comparison blocked.
- Image quality and asset fidelity: existing user avatar/logo source is preserved; authenticated crop and sharpness blocked.
- Copy and content: code contains the approved profile groups and removes history/template entries; rendered authenticated proof blocked.

## Implementation checklist

- Complete login in the in-app Browser.
- Capture and compare the authenticated profile at 390 × 844.
- Test 计划 / 日历 / 历史 switching and home deep links.
- Check console output after authenticated interactions.
- Repeat comparison and change `final result` only after P1/P2 findings are resolved.

final result: blocked
