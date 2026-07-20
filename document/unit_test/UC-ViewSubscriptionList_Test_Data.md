# UC-ViewSubscriptionList: View Subscription List

### 1. RECORD OF CHANGE
| Version | Date | Author | Description |
|---|---|---|---|
| v1.0 | 2026-07-18 | QA Lead | Initial Creation & Deep Audit (Full Coverage) |
| v2.0 | 2026-07-19 | QA Lead | Full Re-Audit: Added Admin endpoint with validation, subscriber counts, role/token checks. Expanded from 3 to 12 UTCIDs. |

### 2. UNIT TEST CASE LIST
| Class Name | Function Name | Total Test Cases |
|---|---|---|
| customerSubscriptionController / subscriptionService | getSubscriptionPlans / getActivePlans | 4 |
| adminSubscriptionController / subscriptionService | getPlans / getAllPlans / withActiveSubscriberCounts | 8 |

### 3. UNIT TEST REPORT
| Function Code | Function Name | Passed | Failed | Untested | Total |
|---|---|---|---|---|---|
| UC-ViewSubscriptionList | View Subscription List | 12 | 0 | 0 | 12 |

### 4. GENERAL INFORMATION
* **Function Code**: UC-ViewSubscriptionList
* **Function Name**: View Subscription List
* **Created By**: Developer
* **Executed By**: QA Auditor
* **Lines of code (LOC)**: 52
* **Lack of test cases**: 0
* **Test requirement**: Validate subscription plan listing for two distinct audiences: (1) Customer/Guest public endpoint returns only ACTIVE plans sorted by price ascending with no authentication required; (2) Admin endpoint returns all non-DELETED plans (or filtered by status query param) sorted by createdAt descending, with optional limit capping (1–500), annotated with live activeSubscriberCount from PartnerSubscription aggregation, and protected by authenticate + restrictTo(ADMIN) middleware.

### 5. RESULTS STATISTICS
* **Passed**: 12
* **Failed**: 0
* **Untested**: 0
* **N / A / B (Normal / Abnormal / Boundary)**: 4 / 3 / 5
* **Total Test Cases**: 12

### 6. TEST CASE DETAILS

| Condition | Parameter / Precondition | UTCID01 | UTCID02 | UTCID03 | UTCID04 | UTCID05 | UTCID06 | UTCID07 | UTCID08 | UTCID09 | UTCID10 | UTCID11 | UTCID12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Precondition** | Database connected | O | O | O | O | O | O | O | O | O | O | O | O |
| | ACTIVE plans exist in database | O | O | | O | O | O | O | O | O | O | O | O |
| | INACTIVE plans exist in database | | | | | O | | | | | | | |
| | No ACTIVE plans exist | | | O | | | | | | | | | |
| | PartnerSubscription records exist for plans | | | | | | O | | | | | | |
| **Endpoint** | endpoint = GET /api/customer/subscriptions/plans | O | O | O | O | | | | | | | | |
| | endpoint = GET /api/admin/subscriptions/ | | | | | O | O | O | O | O | O | O | O |
| **role** | role_any (public, no auth required) | O | O | O | O | | | | | | | | |
| | role_admin = ADMIN | | | | | O | O | O | O | O | | O | O |
| | role_partner = PARTNER | | | | | | | | | | O | | |
| **token** | token_none (public endpoint) | O | O | O | O | | | | | | | | |
| | token_valid = "JWT_Token" | | | | | O | O | O | O | O | | O | O |
| | token_none_or_invalid = null | | | | | | | | | | | | |
| | token_missing = null | | | | | | | | | | O | | |
| **status (query)** | status_omitted = null (default: all non-DELETED) | O | O | O | O | O | O | | | | O | O | |
| | status_active = "ACTIVE" | | | | | | | O | | | | | |
| | status_invalid = "EXPIRED" | | | | | | | | O | | | | |
| | status_deleted = "DELETED" | | | | | | | | | | | | O |
| **limit (query)** | limit_omitted = null (default: 500) | O | O | O | O | O | O | O | O | O | O | | O |
| | limit_boundary = 1 | | | | | | | | | | | O | |
| **Confirm** | **Return** | | | | | | | | | | | | |
| | Plans retrieved successfully (200) | O | O | O | O | O | O | O | | | | O | O |
| | Returns only ACTIVE status plans | O | O | | | | | O | | | | | |
| | Returns all non-DELETED plans | | | | | O | | | | | | | |
| | Returns DELETED status plans only | | | | | | | | | | | | O |
| | Plans sorted by price ascending | O | O | | | | | | | | | | |
| | Plans sorted by createdAt descending | | | | | O | O | O | | | | O | O |
| | activeSubscriberCount populated for each plan | | | | | O | O | | | | | | |
| | activeSubscriberCount = 0 for plans with no subscribers | | | | | O | | | | | | | |
| | activeSubscriberCount > 0 for plans with subscribers | | | | | | O | | | | | | |
| | Empty array returned (no matching plans) | | | O | | | | | | | | | |
| | Returns array with plan fields (name, code, price, duration, features) | O | O | | O | O | O | O | | | | O | O |
| | Validation failed error (400) | | | | | | | | O | | | | |
| | Unauthorized error (401) | | | | | | | | | | O | | |
| | Forbidden access error (403) | | | | | | | | | O | | | |
| | Limit caps results to max N entries | | | | | | | | | | | O | |
| | **Status code** | | | | | | | | | | | | |
| | 200 | O | O | O | O | O | O | O | | | | O | O |
| | 400 | | | | | | | | O | | | | |
| | 401 | | | | | | | | | | O | | |
| | 403 | | | | | | | | | O | | | |
| **Result** | Type(N : Normal, A : Abnormal, B : Boundary) | N | N | B | B | N | N | B | A | A | A | B | B |
| | Passed/Failed | P | P | P | P | P | P | P | P | P | P | P | P |
| | Executed Date | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 | 2026-07-19 |
| | Defect ID | | | | | | | | | | | | |
