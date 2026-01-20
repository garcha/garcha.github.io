---
title: "Wishwala"
tagline: "AI-powered wish generator for every occasion"
description: "A personalized wish generator that uses AI to create heartfelt messages for birthdays, anniversaries, and other special occasions."
status: "active"
featured: false
order: 4
techStack: ["Elixir", "Phoenix", "LiveView", "PostgreSQL", "Tailwind CSS", "OpenAI", "Oban"]
category: "personal"
url: "https://wishwala.com"
startDate: 2023-06-01
problem: "Writing personalized wishes for loved ones can be difficult and time-consuming, especially when you want to say something meaningful."
solution: "An AI-powered platform that generates thoughtful, personalized wishes for any occasion, with the ability to customize and share them."
impact: "Helps people express heartfelt sentiments for birthdays, anniversaries, and other celebrations with ease."
---

## Overview

Wishwala is an AI-powered wish generator that helps you create personalized messages for birthdays, anniversaries, and other special occasions. Instead of struggling to find the right words, users can generate thoughtful wishes tailored to their relationship with the recipient.

## Key Features

### AI-Generated Wishes
- Generate personalized wishes using OpenAI
- Customize wishes for different occasions (birthdays, anniversaries, etc.)
- Tailor messages for specific relationships (parents, friends, partners)

### Wish Management
- Save and organize your favorite wishes
- Publish wishes to share with others
- Browse community-shared wishes for inspiration

### Gift Suggestions
- Integrated gift link recommendations
- Track gift link engagement

## Technical Highlights

Built as a Phoenix LiveView application:
- Real-time updates with Phoenix PubSub
- Background job processing with Oban
- Responsive design with Tailwind CSS
- Deployed on Fly.io for global edge performance
