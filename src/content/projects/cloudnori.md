---
title: "cloudnori Stock Screener"
tagline: "Taleb inspired stock screener focused on survival and avoiding ruin"
description: "A financial screening tool that evaluates stocks based on anti-fragility principles, focusing on what can kill a company rather than what can make it succeed."
status: "development"
featured: false
order: 5
techStack: ["Elixir", "Phoenix", "LiveView", "PostgreSQL", "Tailwind CSS", "Oban", "SEC EDGAR API", "Massive.com API"]
category: "tool"
url: "https://cloudnori.com/"
startDate: 2024-12-01
problem: "Traditional stock screeners focus on growth metrics and upside potential, often overlooking the factors that can lead to catastrophic failure or ruin."
solution: "A screening methodology based on Nassim Taleb's anti-fragility principles, evaluating companies on leverage, cash flow survival, and robustness to identify resilient businesses."
impact: "Helps investors identify companies built to survive market shocks and avoid catastrophic losses by focusing on downside protection first."
---

## Overview

The Anti-Fragility Screener is a stock analysis tool built on Nassim Taleb's principles from "Antifragile" and "Black Swan." Rather than chasing high returns, it focuses on identifying companies that can survive and thrive under stress.

The core philosophy: **Focus on what can kill a company, not what can make it succeed. Survival is the prerequisite for compounding.**

## Key Features

### Anti-Fragility Scoring

- **Leverage Analysis**: Debt-to-equity ratios and net cash position
- **Cash Flow Quality**: Free cash flow margins and earnings quality
- **Survival Runway**: Years of operation without additional financing
- **Failure Mode Detection**: Identifies gradual vs catastrophic collapse risks
- **Robustness Metrics**: Operating margins and return on assets

### Real-Time Data Integration

- Real-time and historical price data from Massive.com
- Financial statements directly from SEC EDGAR
- Automatic quarterly re-screening after earnings releases
- Daily snapshots for performance tracking

### Classification System

Companies are scored on a 0-100 scale across five core filters:

| Level          | Score | Criteria                 |
| -------------- | ----- | ------------------------ |
| Anti-Fragile   | 80+   | All core filters ≥7/10   |
| Robust         | 60+   | All core filters ≥5/10   |
| Fragile        | 40-59 | Some core filters <5/10  |
| Highly Fragile | <40   | Multiple filter failures |

### Background Jobs

- Daily price snapshots
- Weekly performance tracking
- Quarterly re-screening after earnings
- Real-time ruin event detection (bankruptcies, major drawdowns)

## Technical Highlights

Built with Elixir and Phoenix LiveView for real-time, fault-tolerant analysis:

- **SEC EDGAR Integration**: Financial statements
- **Phoenix LiveView**: Real-time updates and interactive screening
- **Oban**: Background job processing for daily snapshots and quarterly re-screens
- **Rate Limiting**: Respectful API usage with aggressive caching
- **Multi-Source Strategy**: Primary data from SEC and Massive.com, with FMP as fallback

## Philosophy

Traditional screeners optimize for upside. This tool optimizes for **not dying**. It's designed for investors who understand that avoiding catastrophic losses is more important than chasing maximum gains.
