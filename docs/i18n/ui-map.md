# kinn UI Structure & Translation Map

This document maps every screen, file path, and localization key across both the Expo mobile app (`artifacts/kin`) and the Vite web app (`artifacts/kin-web`).

---

## 1. Flow Architecture

```mermaid
flowchart TD
    Welcome["Welcome / Language Select<br/>(/)"] -->|Student| EmailStudent["Student Sign Up<br/>(/signup?role=student)"]
    Welcome -->|Personal| EmailPersonal["Personal Sign Up<br/>(/signup?role=personal)"]
    Welcome -->|Sign In| SignIn["Sign In<br/>(/signin)"]
    SignIn -->|Forgot| ForgotAccount["Recover Account<br/>(/forgot-account)"]
    
    EmailStudent --> OTP["OTP Verification<br/>(/otp)"]
    EmailPersonal --> OTP
    SignIn --> OTP
    ForgotAccount --> OTP
    
    OTP --> Step1["Onboarding Step 1: Personal Info<br/>(/onboarding/personal)"]
    Step1 --> Step2["Onboarding Step 2: Occupation & Intent<br/>(/onboarding/occupation)"]
    
    Step2 -->|UR Student| Step3UR["Onboarding Step 3A: UR Verification<br/>(/onboarding/ur)"]
    Step2 -->|Personal / Other| Step3Invite["Onboarding Step 3B: Invite Claim<br/>(/onboarding/invite)"]
    
    Step3UR -->|Verified| MainTabs["Main In-App Tabs<br/>(/(tabs) or /app)"]
    Step3Invite -->|Claimed| MainTabs
    Step3Invite -->|No Invite Code| WaitingRoom["Waiting Room<br/>(/onboarding/waiting)"]
    WaitingRoom -->|Invite Applied / Unlocked| MainTabs

    subgraph MainTabs [Main In-App Tabs]
        Discover["Tab 1: Discover<br/>(Teaser Deck)"]
        Matches["Tab 2: Matches<br/>(Guided Chat List)"]
        Serious["Tab 3: Serious<br/>(Marriage Intent & MoMo)"]
        Profile["Tab 4: Profile<br/>(Photos & Settings)"]
    end

    Matches --> ChatRoom["Active Match Chat<br/>(/match/[matchId])"]
```

---

## 2. Screen-by-Screen Map & Key Inventory

### 2.1 First Touch: Welcome & Language Picker
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/welcome.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/welcome.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/WelcomeScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/WelcomeScreen.tsx) |
| **Route** | `/(onboarding)/welcome` (mobile), `/` (web) |
| **Keys Used** | `welcome.tagline`<br/>`welcome.studentSignUp`<br/>`welcome.orDivider`<br/>`welcome.personalSignUp`<br/>`welcome.alreadyHaveAccount`<br/>`welcome.signInAction`<br/>`welcome.urBadge`<br/>`welcome.inviteBadge`<br/>`welcome.selectLanguage` |

---

### 2.2 Authentication Flow

#### A. Email Sign Up (Role-gated: UR Student vs Personal)
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/email.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/email.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/EmailScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/EmailScreen.tsx) |
| **Route** | `/(onboarding)/email` (mobile), `/signup` (web) |
| **Keys Used** | `auth.email.back`<br/>`auth.email.studentTitle`<br/>`auth.email.personalTitle`<br/>`auth.email.inputLabel`<br/>`auth.email.placeholder`<br/>`auth.email.sendCode`<br/>`auth.email.alreadyHaveAccount`<br/>`auth.email.signInAction`<br/>`auth.email.enterEmail`<br/>`auth.email.invalidFormat`<br/>`auth.email.sendFailed` |

#### B. Sign In
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/sign-in.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/sign-in.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/SignInScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/SignInScreen.tsx) |
| **Route** | `/(onboarding)/sign-in` (mobile), `/signin` (web) |
| **Keys Used** | `auth.signIn.title`<br/>`auth.signIn.emailLabel`<br/>`auth.signIn.emailPlaceholder`<br/>`auth.signIn.sendCode`<br/>`auth.signIn.forgotAccount`<br/>`auth.signIn.noAccount`<br/>`auth.signIn.createAccount`<br/>`auth.signIn.accountNotFound` |

#### C. Forgot / Recover Account
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/forgot-account.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/forgot-account.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/ForgotAccountScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/ForgotAccountScreen.tsx) |
| **Route** | `/(onboarding)/forgot-account` (mobile), `/forgot-account` (web) |
| **Keys Used** | `auth.forgot.title`<br/>`auth.forgot.emailLabel`<br/>`auth.forgot.emailPlaceholder`<br/>`auth.forgot.sendRecoveryCode`<br/>`auth.forgot.rememberAccount`<br/>`auth.forgot.signInAction`<br/>`auth.forgot.noAccountFound` |

#### D. OTP Code Verification
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/otp.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/otp.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OtpScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OtpScreen.tsx) |
| **Route** | `/(onboarding)/otp` (mobile), `/otp` (web) |
| **Keys Used** | `auth.otp.changeEmail`<br/>`auth.otp.changePhone`<br/>`auth.otp.title`<br/>`auth.otp.codeSentTo`<br/>`auth.otp.verify`<br/>`auth.otp.resendCountdown`<br/>`auth.otp.resendCode`<br/>`auth.otp.newCodeSent`<br/>`auth.otp.invalidCode`<br/>`auth.otp.verifyFailed`<br/>`auth.otp.resendFailed` |

---

### 2.3 Onboarding Steps (Promptless & Explanation-Free)

#### Step 1: Personal Information
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/personal.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/personal.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OnboardingPersonal.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OnboardingPersonal.tsx) |
| **Route** | `/(onboarding)/personal` (mobile), `/onboarding/personal` (web) |
| **Keys Used** | `onboarding.personal.step`<br/>`onboarding.personal.title`<br/>`onboarding.personal.fullNameLabel`<br/>`onboarding.personal.fullNamePlaceholder`<br/>`onboarding.personal.dobLabel`<br/>`onboarding.personal.dobPlaceholder`<br/>`onboarding.personal.genderLabel`<br/>`onboarding.personal.genderMale`<br/>`onboarding.personal.genderFemale`<br/>`onboarding.personal.continue`<br/>`onboarding.personal.enterFullName`<br/>`onboarding.personal.selectDob`<br/>`onboarding.personal.enterDateFormat`<br/>`onboarding.personal.mustBe18`<br/>`onboarding.personal.selectGender`<br/>`onboarding.personal.saveFailed` |

#### Step 2: Occupation & Relationship Intent
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/occupation.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/occupation.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OnboardingOccupation.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OnboardingOccupation.tsx) |
| **Route** | `/(onboarding)/occupation` (mobile), `/onboarding/occupation` (web) |
| **Keys Used** | `onboarding.occupation.step`<br/>`onboarding.occupation.title`<br/>`onboarding.occupation.careerLabel`<br/>`onboarding.occupation.careerPlaceholder`<br/>`onboarding.occupation.intentLabel`<br/>`onboarding.occupation.seriousMarriage`<br/>`onboarding.occupation.longTerm`<br/>`onboarding.occupation.casualDating`<br/>`onboarding.occupation.tier1Badge`<br/>`onboarding.occupation.selectOccupation`<br/>`onboarding.occupation.selectIntent`<br/>`onboarding.occupation.chooseCampus`<br/>`onboarding.occupation.continue`<br/>`onboarding.occupation.occStudent`<br/>`onboarding.occupation.occEmployed`<br/>`onboarding.occupation.occBusiness`<br/>`onboarding.occupation.occOther`<br/>`onboarding.occupation.whereDoYouStudy`<br/>`onboarding.occupation.urUniversity`<br/>`onboarding.occupation.otherUniversity`<br/>`onboarding.occupation.city`<br/>`onboarding.occupation.cityPlaceholder`<br/>`onboarding.occupation.lookingFor` |

#### Step 3A: University of Rwanda Verification Branch
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/ur-campus.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/ur-campus.tsx)<br/>[`artifacts/kin/app/(onboarding)/ur-registration.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/ur-registration.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OnboardingUr.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OnboardingUr.tsx) |
| **Route** | `/(onboarding)/ur-campus` & `/ur-registration` (mobile), `/onboarding/ur` (web) |
| **Keys Used** | `onboarding.ur.step`<br/>`onboarding.ur.campusTitle`<br/>`onboarding.ur.campusLabel`<br/>`onboarding.ur.registrationTitle`<br/>`onboarding.ur.registrationLabel`<br/>`onboarding.ur.registrationPlaceholder`<br/>`onboarding.ur.enterRegNumber`<br/>`onboarding.ur.mustBe9Digits`<br/>`onboarding.ur.selectCampusError`<br/>`onboarding.ur.alreadyClaimed`<br/>`onboarding.ur.verifyStudent`<br/>`onboarding.ur.skipNotUr`<br/>`onboarding.ur.verifiedSuccess` |

#### Step 3B: Invite Code Claim Branch
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/invite.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/invite.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OnboardingInvite.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OnboardingInvite.tsx) |
| **Route** | `/(onboarding)/invite` (mobile), `/onboarding/invite` (web) |
| **Keys Used** | `onboarding.invite.step`<br/>`onboarding.invite.title`<br/>`onboarding.invite.codeLabel`<br/>`onboarding.invite.placeholder`<br/>`onboarding.invite.applyCode`<br/>`onboarding.invite.continueToWaiting`<br/>`onboarding.invite.enterCodeError`<br/>`onboarding.invite.invalidCode`<br/>`onboarding.invite.verifiedByMember` |

#### Waiting Room
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(onboarding)/waiting.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(onboarding)/waiting.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/OnboardingWaiting.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/OnboardingWaiting.tsx) |
| **Route** | `/(onboarding)/waiting` (mobile), `/onboarding/waiting` (web) |
| **Keys Used** | `waiting.title`<br/>`waiting.almostThere`<br/>`waiting.queuePosition`<br/>`waiting.positionNumber`<br/>`waiting.trustScore`<br/>`waiting.inviteLinkTitle`<br/>`waiting.copy`<br/>`waiting.copied`<br/>`waiting.share`<br/>`waiting.previewDiscovery`<br/>`waiting.earlyAccessTitle`<br/>`waiting.enterKin` |

---

### 2.4 Main In-App Tabs

#### Tab 1: Discover (Curated Swipe Deck)
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(tabs)/index.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(tabs)/index.tsx)<br/>[`artifacts/kin/components/TeaserSwipeDeck.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/components/TeaserSwipeDeck.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/AppScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/AppScreen.tsx) (`activeTab === 'discover'`) |
| **Route** | `/(tabs)` or `/(tabs)/index` (mobile), `/app` (web) |
| **Keys Used** | `discover.tabTitle`<br/>`discover.goldenBids`<br/>`discover.goldenBidAlert`<br/>`discover.matchAlert`<br/>`discover.urStudentBadge`<br/>`discover.trustBadge`<br/>`discover.noMoreProfiles`<br/>`discover.checkBackLater` |

#### Tab 2: Matches (Active Conversations List)
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(tabs)/matches.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(tabs)/matches.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/AppScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/AppScreen.tsx) (`activeTab === 'matches'`) |
| **Route** | `/(tabs)/matches` (mobile), `/app` (web) |
| **Keys Used** | `matches.tabTitle`<br/>`matches.guidedChatTitle`<br/>`matches.noMatches`<br/>`matches.keepSwiping`<br/>`matches.phaseValues`<br/>`matches.phaseVision`<br/>`matches.phaseFreeTalk`<br/>`matches.timeRemaining` |

#### Tab 3: Serious (Marriage Intent Queue & Token Purchase)
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(tabs)/serious.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(tabs)/serious.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/AppScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/AppScreen.tsx) (`activeTab === 'serious'`) |
| **Route** | `/(tabs)/serious` (mobile), `/app` (web) |
| **Keys Used** | `serious.tabTitle`<br/>`serious.queueTitle`<br/>`serious.description`<br/>`serious.connectionTokens`<br/>`serious.tokensRemaining`<br/>`serious.tokenExplainer` |

#### Tab 4: Profile & Settings
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/(tabs)/profile.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/(tabs)/profile.tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/AppScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/AppScreen.tsx) (`activeTab === 'profile'`) |
| **Route** | `/(tabs)/profile` (mobile), `/app` (web) |
| **Keys Used** | `profile.tabTitle`<br/>`profile.myProfile`<br/>`profile.language`<br/>`profile.languageEn`<br/>`profile.languageRw`<br/>`profile.signOut`<br/>`profile.trustScore`<br/>`profile.urBadge`<br/>`profile.invitedMember`<br/>`profile.version`<br/>`profile.photos`<br/>`profile.settings`<br/>`profile.inviteLink`<br/>`profile.shareInvite`<br/>`profile.invitedCount`<br/>`profile.resumeProfile`<br/>`profile.pauseProfile`<br/>`profile.inviteFriends`<br/>`profile.statsInvites`<br/>`profile.statsTokens`<br/>`profile.statsIntent`<br/>`profile.urStudentVerified`<br/>`profile.verifiedMember` |

---

### 2.5 Active Match Chat
| Metric | Detail |
|---|---|
| **Mobile File** | [`artifacts/kin/app/match/[matchId].tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/match/[matchId].tsx) |
| **Web File** | [`artifacts/kin-web/src/pages/AppScreen.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/AppScreen.tsx) (chat view) |
| **Route** | `/match/[matchId]` (mobile) |
| **Keys Used** | `matches.phaseValues`<br/>`matches.phaseVision`<br/>`matches.phaseFreeTalk`<br/>`matches.timeRemaining`<br/>`matches.typeMessage`<br/>`matches.send`<br/>`common.back` |

---

### 2.6 Global, Notifications & Shared Utilities
| Category | File Paths | Keys Used |
|---|---|---|
| **Common Actions & Errors** | All Screens & Layouts | `common.back`<br/>`common.continue`<br/>`common.cancel`<br/>`common.save`<br/>`common.close`<br/>`common.networkError`<br/>`common.tooManyAttempts`<br/>`common.notFoundTitle`<br/>`common.notFoundAction` |
| **Push Notifications & SMS** | [`artifacts/api-server/src/routes/messages.ts`](file:///home/antigravity/htuyishi-hub/kin/artifacts/api-server/src/routes/messages.ts)<br/>[`artifacts/api-server/src/routes/auth.ts`](file:///home/antigravity/htuyishi-hub/kin/artifacts/api-server/src/routes/auth.ts) | `notification.newMessageTitle`<br/>`notification.newMatchTitle`<br/>`notification.newMatchBody`<br/>`notification.smsVerification`<br/>`notification.smsFailed` |
| **Fallback / 404** | [`artifacts/kin/app/+not-found.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin/app/+not-found.tsx)<br/>[`artifacts/kin-web/src/pages/not-found.tsx`](file:///home/antigravity/htuyishi-hub/kin/artifacts/kin-web/src/pages/not-found.tsx) | `common.notFoundTitle`<br/>`common.notFoundAction` |
