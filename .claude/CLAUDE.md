When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

Always use firecrawl when we need to read content from web page

Always using pnpm to manage project

Do not run the project unless the user told you to run

All the code you write should consider the maintainability

Do not introduce state in the server side code, use database to store the state, consider horizontal scalability

Before you write code, ask these 3 questions:
1. Does your code will make the system hard to modify and read?
2. Does your code will introduce "unknown unknowns" to make the system hard to predict?
3. Does your code will introduce more recognition load?
If the answer is yes, try to improve it by these practice:
1. Strive for deep modules. You want a small surface area (interface) hiding a large volume of implementation.
2. Group code by the knowledge it manages, not the order in which it runs. If a design decision changes, it should ideally only affect one file.
3. Make classes "somewhat general-purpose." Design the module to be general-purpose, but implement only what you need today. The interface should be generic enough that you don't have to change it if you add a new feature later.
4. instead of throwing exceptions, design APIs so that "errors" are handled automatically or treated as normal cases.
5. Comments should explain the interface what the caller needs to know without looking at the implementation and explain why you chose a specific algorithm or data structure
6. Your main focus is great design not just make it work