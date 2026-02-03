import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Jazz Garcha'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    generatedBy: z.enum(['human', 'agent', 'agent-edited']).default('human'),
    agentContext: z.string().optional(),
    image: z.string().optional(),
  }),
});

const projectsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    status: z.enum(['active', 'beta', 'development', 'archived']),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    url: z.string().url().optional(),
    github: z.string().url().optional(),
    techStack: z.array(z.string()),
    category: z.enum(['saas', 'tool', 'personal', 'open-source']),
    startDate: z.coerce.date().optional(),
    launchDate: z.coerce.date().optional(),
    thumbnail: z.string().optional(),
    screenshots: z.array(z.string()).optional(),
    problem: z.string().optional(),
    solution: z.string().optional(),
    impact: z.string().optional(),
  }),
});

export const collections = {
  blog: blogCollection,
  projects: projectsCollection,
};
