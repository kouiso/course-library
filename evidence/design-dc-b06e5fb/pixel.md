# Pixel check — b06e5fb

Design board image and app screenshot compared pixel by pixel (same Chromium, deviceScaleFactor 1). The design side is captured full page, so a board whose content overflows its nominal height is compared to its end. Bands are rows (px) that differ.

## As served (synthetic local runtime)

```
Course.app-course.png 1440x1905 vs 1440x2028 diffpx 883115 bands 445-541 552-613 618-712 726-789 800-892 894-952 954-1108 1122-1185 1196-1288 1291-1348 1351-1444 1458-2027
CourseMobile.app-course.png 390x2300 vs 390x2300 diffpx 219004 bands 365-472 484-505 511-593 600-648 656-724 727-780 783-836 839-965 972-1049 1055-1123 1127-1179 1183-1364 …19
EntryMobile.app-entry.png 390x844 vs 390x844 diffpx 1186 bands 786-798
Library.app-library.png 1440x1100 vs 1440x1604 diffpx 875883 bands 564-588 727-774 789-800 894-915 931-931 972-1603
LibraryMobile.app-library.png 390x1300 vs 390x1855 diffpx 277776 bands 825-849 1014-1031 1058-1095 1115-1134 1148-1148 1165-1854
LoginStates.app-sending.png 1440x760 vs 1440x830 diffpx 674585 bands 0-79 96-641 730-730 760-829
LoginStates.app-wrong.png 1440x760 vs 1440x830 diffpx 671707 bands 0-79 96-641 730-730 760-829
LoginStatesMobile.app-sending.png 390x1180 vs 390x1180 diffpx 229956 bands 0-358 365-391 402-424 428-555 574-594 598-808 1096-1096 1122-1134 1142-1154
LoginStatesMobile.app-wrong.png 390x1180 vs 390x1180 diffpx 243141 bands 0-358 365-391 401-568 578-654 658-671 673-808 1096-1096 1122-1134 1142-1154
Logout.app-logout.png 1440x820 vs 1440x820 diffpx 1186 bands 775-787
LogoutMobile.app-logout.png 390x844 vs 390x844 diffpx 1186 bands 809-821
Main.app-entry.png 1440x1000 vs 1440x1000 diffpx 1186 bands 934-946
Preparing.app-preparing.png 1440x820 vs 1440x820 diffpx 1186 bands 775-787
PreparingMobile.app-preparing.png 390x844 vs 390x844 diffpx 1186 bands 809-821
```

## Library / Course with the kept not-in-design elements hidden for the check only

Hidden only in this check: synthetic notice, verification paragraph, version under the gift button, the paid-product section and the close button on the library. Remaining bands: badge and button (synthetic labels), bundle label (synthetic title), footer version, and below 1640px on Course the board's own background ends at its nominal height (white) while the app keeps the page colour.

```
Course.app-course.png 1440x1905 vs 1440x1905 diffpx 380394 bands 1513-1529 1640-1804 1806-1904
CourseMobile.app-course.png 390x2300 vs 390x2300 diffpx 2871 bands 1384-1400 2263-2275
Library.app-library.png 1440x1100 vs 1440x1100 diffpx 4583 bands 564-588 727-774 1034-1046
LibraryMobile.app-library.png 390x1300 vs 390x1300 diffpx 3706 bands 825-849 1014-1031 1242-1254
```

## Login state cards (board section vs app .login-card)

Exact heights from getBoundingClientRect are equal (PC wrong 388.890625 / sending 327.390625, mobile wrong 382.375 / sending 298.78125). The board places the cards at another y (no header), so the few differing pixels are sub-pixel rounding of the same layout.

```
LoginStates.el-design-0.png LoginStates.el-app-wrong.png 564x389 vs 564x390 diffpx 576 bands 4-5 232-232 255-255 306-306 389-389
LoginStates.el-design-1.png LoginStates.el-app-sending.png 564x328 vs 564x328 diffpx 1198 bands 307-327
LoginStatesMobile.el-design-0.png LoginStatesMobile.el-app-wrong.png 354x383 vs 354x383 diffpx 0 bands 
LoginStatesMobile.el-design-1.png LoginStatesMobile.el-app-sending.png 354x300 vs 354x299 diffpx 749 bands 0-2 166-170 258-271 299-299
```
