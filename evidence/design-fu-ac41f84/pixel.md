# Pixel compare: design-dc-b06e5fb vs design-fu-ac41f84

Rows at y < 45 (caption strip) are skipped. Command: pixdiff.cjs design-dc-b06e5fb design-fu-ac41f84

```
Course.png diffpx 0 firstY -
CourseMobile.png diffpx 0 firstY -
EntryMobile.png diffpx 0 firstY -
Library.png diffpx 0 firstY -
LibraryMobile.png diffpx 0 firstY -
LoginStates.png diffpx 0 firstY -
LoginStatesMobile.png diffpx 0 firstY -
Logout.png diffpx 0 firstY -
LogoutMobile.png diffpx 0 firstY -
Main.png diffpx 0 firstY -
Preparing.png diffpx 0 firstY -
PreparingMobile.png diffpx 0 firstY -
```

CourseMobile / LoginStatesMobile / PreparingMobile composites are 3-4px wider than b06e5fb because the caption label is wider; the extra right-edge columns below the caption are the plain composite background (136,136,136) in both.

## Fractional width (browser zoom), learning page /courses/typescript

Chromium --force-device-scale-factor=1.33 --window-size=720 gives a CSS width of 720.3px. Visible .wide-only / .narrow-only counts:

```
base 74016e6: {"inner":720,"vv":720.3007202148438,"dpr":1.3300000429153442,"mq":"(min-width:721px)=false (max-width:720px)=false not all and (max-width:720px)=true","wide":13,"narrow":11}
head ac41f84: {"inner":720,"vv":720.3007202148438,"dpr":1.3300000429153442,"mq":"(min-width:721px)=false (max-width:720px)=false not all and (max-width:720px)=true","wide":13,"narrow":0}
```

## Screens without a board (1440 / 390, deviceScaleFactor 1)

```
head ac41f84 1440 guide 200 {"footer":"教材ライブラリ · 0.2.2-synthetic / 回答後に届いたご案内のURLをブックマークしてご利用ください。","shortNote":false,"longNote":true,"crumbX":260,"cardX":260,"scrollW":1440}
head ac41f84 1440 product 200 {"footer":"教材ライブラリ · 0.2.1 / 回答後に届いたご案内のURLをブックマークしてご利用ください。","shortNote":false,"longNote":true,"crumbX":260,"cardX":260,"scrollW":1440}
head ac41f84 1440 locked 403 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":375,"cardX":375,"scrollW":1440}
head ac41f84 1440 pending 200 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":375,"cardX":375,"scrollW":1440}
head ac41f84 390 guide 200 {"footer":"教材ライブラリ · 0.2.2-synthetic / ご案内のURLをブックマークしてご利用ください。","shortNote":true,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
head ac41f84 390 product 200 {"footer":"教材ライブラリ · 0.2.1 / ご案内のURLをブックマークしてご利用ください。","shortNote":true,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
head ac41f84 390 locked 403 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
head ac41f84 390 pending 200 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
```

```
base 74016e6 1440 guide 200 {"footer":"教材ライブラリ · 0.2.2-synthetic / 回答後に届いたご案内のURLをブックマークしてご利用ください。","shortNote":false,"longNote":true,"crumbX":260,"cardX":260,"scrollW":1440}
base 74016e6 1440 product 200 {"footer":"教材ライブラリ · 0.2.1 / 回答後に届いたご案内のURLをブックマークしてご利用ください。","shortNote":false,"longNote":true,"crumbX":260,"cardX":260,"scrollW":1440}
base 74016e6 1440 locked 403 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":56,"cardX":375,"scrollW":1440}
base 74016e6 1440 pending 200 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":56,"cardX":375,"scrollW":1440}
base 74016e6 390 guide 200 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
base 74016e6 390 product 200 {"footer":"教材ライブラリ · 0.2.1","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
base 74016e6 390 locked 403 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
base 74016e6 390 pending 200 {"footer":"教材ライブラリ · 0.2.2-synthetic","shortNote":false,"longNote":false,"crumbX":18,"cardX":18,"scrollW":390}
```
