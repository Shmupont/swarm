"""Seed demo data for the Swarm marketplace."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.marketplace.database import init_db, engine
from src.marketplace.models import User, AgentProfile
from src.marketplace.auth import hash_password
from sqlmodel import Session, select

DEMO_AGENTS = [
    {
        "name": "TaxBot Pro",
        "tagline": "AI-powered tax preparation and advisory for individuals and small businesses",
        "description": "TaxBot Pro handles everything from W-2 analysis to complex multi-state filing. Built on the latest tax code, it identifies deductions you might miss and ensures compliance. Trusted by 500+ small businesses.",
        "category": "tax",
        "tags": ["tax", "accounting", "compliance", "W-2", "1099"],
        "capabilities": ["Tax filing", "W-2 analysis", "Deduction optimization", "Multi-state returns", "Quarterly estimates"],
        "pricing_model": "From $49/return",
        "is_featured": True,
        "total_hires": 127,
        "tasks_completed": 342,
        "total_earned_cents": 1675000,
        "avg_rating": 4.8,
        "response_time_hours": 2.0,
    },
    {
        "name": "LegalEagle",
        "tagline": "Contract review and legal document analysis in minutes, not days",
        "description": "LegalEagle reviews contracts, NDAs, employment agreements, and terms of service. It highlights risks, suggests amendments, and explains legal jargon in plain English. SOC 2 compliant.",
        "category": "legal",
        "tags": ["legal", "contracts", "NDA", "compliance"],
        "capabilities": ["Contract review", "Risk assessment", "NDA analysis", "Plain-English summaries", "Amendment suggestions"],
        "pricing_model": "From $25/document",
        "is_featured": True,
        "total_hires": 89,
        "tasks_completed": 234,
        "total_earned_cents": 890000,
        "avg_rating": 4.6,
        "response_time_hours": 1.0,
    },
    {
        "name": "DataCrunch",
        "tagline": "Transform raw data into actionable insights with automated analysis pipelines",
        "description": "DataCrunch ingests CSV, JSON, SQL databases, and APIs. It cleans, analyzes, and visualizes data automatically, producing executive-ready reports with statistical rigor.",
        "category": "data-analysis",
        "tags": ["data", "analytics", "visualization", "statistics", "ETL"],
        "capabilities": ["Data cleaning", "Statistical analysis", "Visualization", "Report generation", "Anomaly detection"],
        "pricing_model": "From $75/analysis",
        "is_featured": True,
        "total_hires": 156,
        "tasks_completed": 412,
        "total_earned_cents": 2340000,
        "avg_rating": 4.9,
        "response_time_hours": 4.0,
    },
    {
        "name": "CodeShip",
        "tagline": "Full-stack development agent — from feature spec to deployed code",
        "description": "CodeShip writes production-quality code across Python, TypeScript, Go, and Rust. It handles architecture, implementation, testing, and deployment. Integrates with GitHub, GitLab, and Jira.",
        "category": "software-development",
        "tags": ["code", "development", "fullstack", "deployment", "CI/CD"],
        "capabilities": ["Full-stack development", "Code review", "Testing", "CI/CD setup", "Architecture design"],
        "pricing_model": "From $100/task",
        "is_featured": True,
        "total_hires": 203,
        "tasks_completed": 567,
        "total_earned_cents": 4560000,
        "avg_rating": 4.7,
        "response_time_hours": 1.5,
    },
    {
        "name": "MarketMind",
        "tagline": "AI-driven marketing strategy, content creation, and campaign optimization",
        "description": "MarketMind crafts marketing strategies, writes copy, manages ad campaigns, and tracks KPIs. From SEO-optimized blog posts to social media calendars, it handles the full marketing stack.",
        "category": "marketing",
        "tags": ["marketing", "content", "SEO", "advertising", "social media"],
        "capabilities": ["Content strategy", "Ad campaign management", "SEO optimization", "Social media", "Analytics"],
        "pricing_model": "From $150/month",
        "is_featured": True,
        "total_hires": 78,
        "tasks_completed": 189,
        "total_earned_cents": 1120000,
        "avg_rating": 4.5,
        "response_time_hours": 3.0,
    },
    {
        "name": "ResearchBot",
        "tagline": "Deep research agent that synthesizes information from thousands of sources",
        "description": "ResearchBot conducts comprehensive research across academic papers, news, patents, and market reports. It produces structured summaries with citations and identifies key trends.",
        "category": "research",
        "tags": ["research", "analysis", "academic", "market research", "synthesis"],
        "capabilities": ["Literature review", "Market analysis", "Trend identification", "Citation management", "Executive summaries"],
        "pricing_model": "From $50/report",
        "total_hires": 92,
        "tasks_completed": 156,
        "total_earned_cents": 780000,
        "avg_rating": 4.4,
        "response_time_hours": 6.0,
    },
    {
        "name": "FinanceGPT",
        "tagline": "Financial modeling, forecasting, and portfolio analysis on autopilot",
        "description": "FinanceGPT builds financial models, runs Monte Carlo simulations, analyzes portfolios, and generates investor-ready reports. Used by 50+ startups for fundraising prep.",
        "category": "finance",
        "tags": ["finance", "modeling", "forecasting", "portfolio", "investment"],
        "capabilities": ["Financial modeling", "Cash flow forecasting", "Portfolio analysis", "Valuation", "Risk assessment"],
        "pricing_model": "From $200/model",
        "total_hires": 64,
        "tasks_completed": 98,
        "total_earned_cents": 1960000,
        "avg_rating": 4.7,
        "response_time_hours": 8.0,
    },
    {
        "name": "WriteFlow",
        "tagline": "Professional writing agent for blogs, docs, and long-form content",
        "description": "WriteFlow produces polished content in your brand voice. From technical documentation to thought leadership pieces, it writes, edits, and formats to publication standards.",
        "category": "writing",
        "tags": ["writing", "content", "copywriting", "documentation", "editing"],
        "capabilities": ["Blog posts", "Technical docs", "Copywriting", "Editing", "Style adaptation"],
        "pricing_model": "From $30/article",
        "total_hires": 145,
        "tasks_completed": 389,
        "total_earned_cents": 1167000,
        "avg_rating": 4.3,
        "response_time_hours": 2.0,
    },
    {
        "name": "SupportHero",
        "tagline": "24/7 customer support agent with human-level empathy and resolution",
        "description": "SupportHero handles customer tickets, live chat, and email support. It resolves issues, escalates appropriately, and maintains a 95%+ satisfaction rating. Integrates with Zendesk, Intercom, and Freshdesk.",
        "category": "customer-support",
        "tags": ["support", "customer service", "helpdesk", "chat", "tickets"],
        "capabilities": ["Ticket resolution", "Live chat", "Email support", "Knowledge base", "Escalation management"],
        "pricing_model": "From $500/month",
        "total_hires": 34,
        "tasks_completed": 1230,
        "total_earned_cents": 3400000,
        "avg_rating": 4.6,
        "response_time_hours": 0.1,
    },
    {
        "name": "DesignForge",
        "tagline": "UI/UX design agent that creates pixel-perfect interfaces and prototypes",
        "description": "DesignForge generates wireframes, high-fidelity mockups, and interactive prototypes. It follows design systems, ensures accessibility compliance, and exports production-ready assets.",
        "category": "design",
        "tags": ["design", "UI", "UX", "prototyping", "figma"],
        "capabilities": ["UI design", "Wireframing", "Prototyping", "Design systems", "Accessibility audit"],
        "pricing_model": "From $75/screen",
        "total_hires": 56,
        "tasks_completed": 178,
        "total_earned_cents": 1335000,
        "avg_rating": 4.5,
        "response_time_hours": 4.0,
    },
    {
        "name": "SecureGuard",
        "tagline": "Automated security auditing and vulnerability assessment",
        "description": "SecureGuard scans codebases, infrastructure, and APIs for vulnerabilities. It produces prioritized findings with remediation steps and tracks compliance against OWASP, SOC 2, and ISO 27001.",
        "category": "security",
        "tags": ["security", "audit", "vulnerability", "compliance", "OWASP"],
        "capabilities": ["Code scanning", "Penetration testing", "Compliance auditing", "Vulnerability assessment", "Remediation plans"],
        "pricing_model": "From $300/audit",
        "total_hires": 41,
        "tasks_completed": 87,
        "total_earned_cents": 2610000,
        "avg_rating": 4.8,
        "response_time_hours": 12.0,
    },
    {
        "name": "SalesEngine",
        "tagline": "AI sales agent for prospecting, outreach, and pipeline management",
        "description": "SalesEngine identifies prospects, crafts personalized outreach, manages follow-ups, and tracks pipeline metrics. Integrates with Salesforce, HubSpot, and LinkedIn.",
        "category": "sales",
        "tags": ["sales", "prospecting", "outreach", "CRM", "pipeline"],
        "capabilities": ["Lead generation", "Email outreach", "Follow-up sequences", "Pipeline analytics", "CRM integration"],
        "pricing_model": "From $200/month",
        "total_hires": 67,
        "tasks_completed": 445,
        "total_earned_cents": 2680000,
        "avg_rating": 4.4,
        "response_time_hours": 1.0,
    },
]


def seed():
    init_db()

    with Session(engine) as session:
        # Create demo user
        existing = session.exec(select(User).where(User.email == "matt@swarm.app")).first()
        if existing:
            print("Seed data already exists. Skipping.")
            return

        matt = User(
            email="matt@swarm.app",
            password_hash=hash_password("password123"),
            display_name="Matt",
        )
        session.add(matt)

        sarah = User(
            email="sarah@swarm.app",
            password_hash=hash_password("password123"),
            display_name="Sarah Chen",
        )
        session.add(sarah)
        session.flush()

        # Create agents
        for i, agent_data in enumerate(DEMO_AGENTS):
            owner = matt if i % 3 != 2 else sarah
            slug = agent_data["name"].lower().replace(" ", "-").replace("/", "-")

            agent = AgentProfile(
                owner_id=owner.id,
                name=agent_data["name"],
                slug=slug,
                tagline=agent_data.get("tagline"),
                description=agent_data.get("description", ""),
                category=agent_data.get("category", "other"),
                tags=agent_data.get("tags", []),
                capabilities=agent_data.get("capabilities", []),
                pricing_model=agent_data.get("pricing_model"),
                is_featured=agent_data.get("is_featured", False),
                total_hires=agent_data.get("total_hires", 0),
                tasks_completed=agent_data.get("tasks_completed", 0),
                total_earned_cents=agent_data.get("total_earned_cents", 0),
                avg_rating=agent_data.get("avg_rating"),
                response_time_hours=agent_data.get("response_time_hours"),
            )
            session.add(agent)

        session.commit()
        print(f"Seeded 2 users and {len(DEMO_AGENTS)} agents.")
        print("Login: matt@swarm.app / password123")
        print("Login: sarah@swarm.app / password123")


if __name__ == "__main__":
    seed()
