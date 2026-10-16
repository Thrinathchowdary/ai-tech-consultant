# Evaluation Report

## Benchmark conditions

The three deterministic suites each contain 20 cases and passed locally on 2026-10-16. They run without an Anthropic key: Task 1 uses an in-memory fixture index, Task 2 mocks the knowledge client for model-independent behavior, and Task 3 uses deterministic extraction and mocked feasibility responses. Therefore the hard cost for the recorded evaluation runs is **$0.00** and no live Claude latency was captured. A production benchmark must record token usage and request timestamps around real model calls; inventing p50/p95 values would make this report misleading.

| System                  | Cases | Passed |                  Quality / factual support |                     p50 latency |                     p95 latency | Cost per recorded run |
| ----------------------- | ----: | -----: | -----------------------------------------: | ------------------------------: | ------------------------------: | --------------------: |
| Task 1 Knowledge Brain  |    20 |     20 | 100% relevant answer + citation assertions |    N/A: no HTTP timing captured |    N/A: no HTTP timing captured |                 $0.00 |
| Task 2 Inbox Agent      |    20 |     20 |                     100% assertions passed | N/A: deterministic/mocked suite | N/A: deterministic/mocked suite |                 $0.00 |
| Task 3 Meeting to Scope |    20 |     20 |        100% extraction and diff assertions | N/A: deterministic/mocked suite | N/A: deterministic/mocked suite |                 $0.00 |

The quality percentages mean passed evaluation assertions, not a claim that an unaudited production model is 100% accurate.

## Task 1: 20 retrieval cases

|   # | Query intent              | Expected evidence       | Result |
| --: | ------------------------- | ----------------------- | ------ |
|   1 | Reset password            | password citation       | Pass   |
|   2 | Edit profile              | profile citation        | Pass   |
|   3 | Member sign-in            | login citation          | Pass   |
|   4 | Change email              | email citation          | Pass   |
|   5 | Upload logo               | logo citation           | Pass   |
|   6 | Billing settings          | billing citation        | Pass   |
|   7 | Cancel subscription       | cancel citation         | Pass   |
|   8 | Add team member           | team citation           | Pass   |
|   9 | Notifications             | notification citation   | Pass   |
|  10 | Configure domain          | domain citation         | Pass   |
|  11 | Export member data        | export citation         | Pass   |
|  12 | Open support ticket       | ticket citation         | Pass   |
|  13 | Company details           | company citation        | Pass   |
|  14 | Add directory listing     | listing citation        | Pass   |
|  15 | Change theme              | theme citation          | Pass   |
|  16 | Find analytics            | analytics citation      | Pass   |
|  17 | Invite user               | invite citation         | Pass   |
|  18 | Two-factor authentication | authentication citation | Pass   |
|  19 | Update payment details    | payment citation        | Pass   |
|  20 | Contact support           | support citation        | Pass   |

## Task 2: 20 inbox cases

|   # | Evaluation                                        | Result |
| --: | ------------------------------------------------- | ------ |
|   1 | Corpus has exactly 50 emails                      | Pass   |
|   2 | Category distribution is 12/10/6/6/6/5/5          | Pass   |
|   3 | Setup question classified how-to                  | Pass   |
|   4 | Broken export classified troubleshooting          | Pass   |
|   5 | Custom integration classified project request     | Pass   |
|   6 | Refund classified high risk                       | Pass   |
|   7 | Legal complaint classified high urgency/high risk | Pass   |
|   8 | Pricing classified quote/medium risk              | Pass   |
|   9 | Update request classified follow-up               | Pass   |
|  10 | Classifier output passes Zod                      | Pass   |
|  11 | Nineteen approvals remain ineligible              | Pass   |
|  12 | Twenty clean approvals become eligible            | Pass   |
|  13 | Edit resets progress                              | Pass   |
|  14 | Rejection resets progress                         | Pass   |
|  15 | High-risk approval does not advance               | Pass   |
|  16 | Client preserves citations/escalation             | Pass   |
|  17 | Connection error is wrapped                       | Pass   |
|  18 | Malformed response is rejected                    | Pass   |
|  19 | Draft includes citations                          | Pass   |
|  20 | Draft flags escalation/high risk                  | Pass   |

## Task 3: 20 meeting-to-scope cases

|   # | Evaluation                               | Result |
| --: | ---------------------------------------- | ------ |
|   1 | Transcript is chunked                    | Pass   |
|   2 | Requirements receive sequential IDs      | Pass   |
|   3 | Search requirement extracted             | Pass   |
|   4 | Combined filters extracted               | Pass   |
|   5 | Mobile requirements categorized as UX    | Pass   |
|   6 | Decisions preserved                      | Pass   |
|   7 | Client assumptions preserved             | Pass   |
|   8 | Stripe/payment requirement extracted     | Pass   |
|   9 | Task 1 failure becomes human-reviewable  | Pass   |
|  10 | Native answer classified native setting  | Pass   |
|  11 | Custom answer classified custom code     | Pass   |
|  12 | Scope has one task per requirement       | Pass   |
|  13 | Low/likely/high estimates are ordered    | Pass   |
|  14 | Unapproved scope cannot produce proposal | Pass   |
|  15 | Human can approve scope                  | Pass   |
|  16 | Approved scope produces proposal         | Pass   |
|  17 | Delivery-time filter is Added            | Pass   |
|  18 | Mobile behavior is Modified              | Pass   |
|  19 | Synonym deliverable is Removed           | Pass   |
|  20 | Checkout is Out-of-Scope                 | Pass   |

## Model comparison

| Workload              | Claude 3.5 Sonnet                                                     | Claude 3.5 Haiku                                      | Selected policy                                                                                     |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Inbox classification  | Better with ambiguous, multi-intent messages; higher cost and latency | Faster and cheaper for explicit category/risk signals | Haiku for routine triage; escalate uncertainty                                                      |
| RAG answering         | More capable of reconciling multiple cited chunks                     | Lower latency for short, single-article answers       | Use retrieved evidence for both; Sonnet for ambiguous cases                                         |
| Transcript extraction | Stronger at implied decisions, exclusions, and scope conflicts        | Fast for clean, structured transcripts                | Sonnet for discovery/follow-up synthesis; deterministic schemas and human approval remain mandatory |

This is a capability comparison, not a live A/B result: no authenticated Sonnet or Haiku calls were included in the recorded run. The next benchmark should replay the same 60 cases with each model, capture p50/p95 request latency, token counts, citation support, and reviewer corrections, then compute cost from provider pricing at the time of the run.
