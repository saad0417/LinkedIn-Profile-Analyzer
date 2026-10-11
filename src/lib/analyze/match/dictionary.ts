// Curated keyword dictionary for deterministic JD matching.
// Format: "Display|alias|alias". The first alias is the display name. An alias
// prefixed with "=" is matched case-sensitively (needed for terms that are also
// English words or letters: Go, R, C, Excel, Epic, Lean).
// Aliases are matched with word boundaries and an optional plural "s".

export const HARD_SKILLS: string[] = [
  // Programming languages
  "JavaScript|JS|ECMAScript", "TypeScript|TS", "Python", "Java", "Kotlin", "Scala", "=Go|Golang", "=Rust", "C++|CPP", "C#|C-Sharp|CSharp",
  "=C", "=Ruby", "PHP", "=Swift", "Objective-C", "=Dart", "Perl", "=R", "MATLAB", "=Julia", "Haskell", "Elixir", "Erlang", "Clojure",
  "Lua", "Groovy", "Visual Basic|VB.NET", "VBA", "COBOL", "Fortran", "Solidity", "Bash|Shell scripting", "PowerShell", "SQL",
  "T-SQL", "PL/SQL", "HTML|HTML5", "CSS|CSS3", "Sass|SCSS", "GraphQL", "WebAssembly|Wasm",
  // Frameworks & libraries
  "React|React.js|ReactJS", "React Native", "Next.js|NextJS", "Vue|Vue.js|VueJS", "Nuxt", "Angular", "Svelte", "Redux", "jQuery",
  "Node.js|NodeJS", "=Express|Express.js", "NestJS", "Deno", "Django", "Flask", "FastAPI", "Spring|Spring Boot", "Hibernate",
  "Ruby on Rails|=Rails", "Laravel", "Symfony", ".NET|dotnet|.NET Core|ASP.NET", "Entity Framework", "Flutter", "SwiftUI",
  "Jetpack Compose", "Tailwind|Tailwind CSS", "Bootstrap", "Material UI|MUI", "Storybook", "Webpack", "Vite", "Babel",
  "Jest", "Cypress", "Playwright", "Selenium", "Mocha", "JUnit", "pytest", "Cucumber", "Postman",
  "pandas", "NumPy", "SciPy", "scikit-learn|sklearn", "TensorFlow", "PyTorch", "Keras", "Hugging Face", "LangChain", "OpenCV",
  "spaCy", "NLTK", "XGBoost", "LightGBM", "=Prophet", "Matplotlib", "Seaborn", "Plotly", "D3.js|D3", "Chart.js",
  // Data & ML concepts
  "Machine Learning|=ML", "Deep Learning", "Natural Language Processing|NLP", "Computer Vision", "Large Language Models|LLM|LLMs",
  "Generative AI|GenAI", "MLOps", "Data Science", "Data Analysis|Data Analytics", "Data Engineering", "Data Modeling|Data Modelling",
  "Data Visualization|Data Visualisation", "Data Warehousing|Data Warehouse", "ETL|ELT", "Statistics|Statistical Analysis",
  "A/B Testing|AB Testing|Experimentation", "Regression", "Forecasting", "Time Series", "Predictive Modeling|Predictive Modelling",
  "Big Data", "Feature Engineering", "Recommendation Systems",
  // Data platforms
  "PostgreSQL|Postgres", "MySQL", "SQL Server|MSSQL", "=Oracle", "SQLite", "MongoDB", "Redis", "Cassandra", "DynamoDB",
  "Elasticsearch|OpenSearch", "Neo4j", "Snowflake", "BigQuery", "Redshift", "Databricks", "=Spark|Apache Spark|PySpark",
  "Hadoop", "=Hive", "Kafka|Apache Kafka", "RabbitMQ", "Airflow|Apache Airflow", "dbt", "Looker", "Tableau", "Power BI|PowerBI",
  "Qlik", "=Excel|Microsoft Excel|MS Excel", "Google Sheets", "Power Query", "Pivot Tables", "SPSS", "=SAS", "Stata", "Alteryx",
  "Google Analytics|GA4|Google Analytics 4", "Mixpanel", "Amplitude", "=Segment",
  // Cloud & DevOps
  "AWS|Amazon Web Services", "Azure|Microsoft Azure", "GCP|Google Cloud|Google Cloud Platform", "EC2", "S3", "=Lambda|AWS Lambda",
  "EKS", "ECS", "CloudFormation", "Terraform", "Pulumi", "Ansible", "=Chef", "=Puppet", "Docker", "Kubernetes|K8s", "=Helm",
  "OpenShift", "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI", "CI/CD|Continuous Integration|Continuous Delivery",
  "Git", "GitHub", "GitLab", "Bitbucket", "Linux", "Unix", "Windows Server", "Nginx", "=Apache", "Prometheus", "Grafana",
  "Datadog", "Splunk", "New Relic", "ELK", "Serverless", "Microservices", "Distributed Systems", "Event-Driven Architecture|Event Driven",
  "REST|RESTful|REST API|REST APIs", "gRPC", "SOAP", "WebSockets", "OAuth", "System Design", "Site Reliability|SRE",
  "Observability", "Infrastructure as Code|IaC", "DevOps", "DevSecOps", "Networking", "TCP/IP", "DNS", "VPN", "Load Balancing",
  // Security
  "Cybersecurity|Cyber Security|Information Security", "Penetration Testing|Pen Testing", "SIEM", "SOC 2|SOC2", "ISO 27001",
  "NIST", "OWASP", "Vulnerability Management", "Identity and Access Management|IAM", "Firewalls", "Incident Response",
  "PCI DSS|PCI-DSS", "GDPR", "HIPAA",
  // Product, project, process
  "Agile", "Scrum", "Kanban", "=Lean", "Six Sigma|Lean Six Sigma", "Waterfall", "PRINCE2", "PMP", "Jira", "Confluence", "Asana",
  "Trello", "Monday.com", "MS Project|Microsoft Project", "Smartsheet", "Product Management", "Product Roadmap|Roadmapping",
  "User Stories", "Requirements Gathering", "Business Analysis", "Process Improvement", "Change Management", "Risk Management",
  "Project Management", "Program Management|Programme Management", "Vendor Management", "Budgeting|Budget Management",
  "OKRs", "KPIs|KPI", "SLAs|SLA", "ITIL", "ServiceNow", "Zendesk", "Freshdesk", "Intercom",
  // Design
  "Figma", "=Sketch", "Adobe XD", "Adobe Creative Suite|Creative Cloud", "Photoshop|Adobe Photoshop", "Illustrator|Adobe Illustrator",
  "InDesign|Adobe InDesign", "After Effects", "Premiere Pro", "Canva", "UX Design|User Experience", "UI Design|User Interface",
  "UX Research|User Research", "Usability Testing", "Wireframing|Wireframes", "Prototyping", "Design Systems|Design System",
  "Information Architecture", "Interaction Design", "Accessibility|WCAG|a11y", "Typography", "Branding|Brand Identity",
  "Motion Design", "3D Modeling|3D Modelling", "Blender", "AutoCAD", "SolidWorks", "Revit", "SketchUp",
  // Marketing & sales
  "SEO|Search Engine Optimization|Search Engine Optimisation", "SEM|Search Engine Marketing", "PPC|Pay-Per-Click",
  "Google Ads|AdWords", "Meta Ads|Facebook Ads", "LinkedIn Ads", "Paid Social", "Social Media Marketing", "Content Marketing",
  "Email Marketing", "Marketing Automation", "HubSpot", "Marketo", "Mailchimp", "Salesforce|SFDC", "Salesforce Marketing Cloud",
  "CRM", "Pardot", "Copywriting", "Content Strategy", "Brand Strategy", "Market Research", "Competitive Analysis",
  "Go-to-Market|GTM", "Demand Generation", "Lead Generation", "Growth Marketing", "Conversion Rate Optimization|CRO",
  "Influencer Marketing", "Public Relations|=PR", "Event Marketing", "Affiliate Marketing", "E-commerce|Ecommerce", "Shopify",
  "B2B Sales", "B2C", "SaaS", "Account Management", "Key Account Management", "Business Development", "Cold Calling",
  "Prospecting", "Pipeline Management", "Sales Forecasting", "Negotiation", "Outreach", "Salesloft", "=Gong", "MEDDIC|MEDDPICC",
  "Solution Selling", "Consultative Selling", "Customer Success", "Upselling", "Quota Attainment",
  // Finance & accounting
  "IFRS", "GAAP|US GAAP|UK GAAP", "Financial Reporting", "Financial Modeling|Financial Modelling", "Financial Analysis",
  "FP&A|Financial Planning and Analysis", "Budgeting and Forecasting", "Variance Analysis", "Consolidation|Consolidations",
  "Month-End Close|Month End Close|Month-End", "Reconciliations|Reconciliation|Balance Sheet Reconciliations", "Accounts Payable",
  "Accounts Receivable", "General Ledger", "Payroll", "Taxation|Tax Compliance|Tax Returns", "VAT", "Audit|Auditing|External Audit|Internal Audit",
  "Internal Controls", "SOX|Sarbanes-Oxley", "Treasury", "Cash Flow|Cash Flow Management", "Valuation", "DCF", "M&A|Mergers and Acquisitions",
  "Due Diligence", "Equity Research", "Portfolio Management", "Risk Analysis", "Credit Analysis", "Bloomberg", "QuickBooks", "Xero",
  "=Sage", "NetSuite", "SAP", "SAP S/4HANA|S/4HANA", "Oracle Financials", "Workday", "BlackLine", "Hyperion", "Anaplan",
  "ACA", "ACCA", "CIMA", "CPA", "CFA", "CMA", "Chartered Accountant",
  // HR
  "Recruitment|Recruiting|Talent Acquisition", "Onboarding", "Employee Relations", "Performance Management", "Compensation and Benefits|Compensation & Benefits",
  "Benefits Administration", "HRIS", "Greenhouse", "=Lever", "BambooHR", "SuccessFactors", "Learning and Development|L&D",
  "Employment Law", "FMLA", "SHRM-CP|SHRM", "CIPD", "Workforce Planning", "Diversity and Inclusion|DEI|D&I",
  // Healthcare
  "Patient Care", "Patient Assessment", "Triage", "Electronic Health Records|EHR|EMR", "=Epic", "Cerner", "Meditech", "BLS|Basic Life Support",
  "ACLS|Advanced Cardiac Life Support", "PALS|Pediatric Advanced Life Support", "TNCC", "CPR", "IV Therapy|Intravenous Therapy",
  "Medication Administration", "Wound Care", "Critical Care", "Emergency Care|Emergency Nursing", "Infection Control", "Phlebotomy",
  "Telemetry", "Clinical Documentation", "Care Planning", "Registered Nurse|RN", "NCLEX", "Clinical Research", "GCP Guidelines|Good Clinical Practice",
  "Pharmacology", "Medical Coding", "ICD-10", "CPT", "Medical Terminology", "Patient Safety", "Case Management",
  // Operations, supply chain, logistics
  "Supply Chain|Supply Chain Management", "Logistics", "Procurement", "Purchasing", "Inventory Management", "Inventory Optimization|Inventory Optimisation",
  "Demand Planning", "S&OP|Sales and Operations Planning", "Warehouse Management|WMS", "ERP", "MRP", "Lean Manufacturing", "Kaizen", "5S",
  "Root Cause Analysis", "Quality Assurance|=QA", "Quality Control|=QC", "ISO 9001", "Health and Safety|Health & Safety|HSE|EHS", "OSHA",
  "Freight Forwarding", "=Customs", "Import/Export", "Fleet Management", "Transportation Management|TMS", "Forklift", "Operations Management",
  "Facilities Management", "Contract Management", "Category Management", "Merchandising", "Retail Operations",
  // Legal & admin & education & misc
  "Contract Negotiation", "Legal Research", "Litigation", "Compliance|Regulatory Compliance", "Anti-Money Laundering|AML", "KYC",
  "Microsoft Office|MS Office|Office 365|Microsoft 365", "Microsoft Word|MS Word", "PowerPoint|Microsoft PowerPoint", "=Outlook|Microsoft Outlook",
  "Google Workspace|G Suite", "Data Entry", "Bookkeeping", "Scheduling", "Customer Service", "Call Centre|Call Center", "Point of Sale|POS",
  "Cash Handling", "Curriculum Development", "Lesson Planning", "Classroom Management", "Instructional Design", "LMS|Learning Management System",
  "Technical Writing", "Editing", "Proofreading", "Translation", "Journalism", "UX Writing", "Plain Language", "Content Design",
  "Video Editing", "Photography", "Public Speaking", "Opera PMS", "Hospitality", "Food Safety",
  // Certifications
  "AWS Certified|AWS Certification", "Certified Kubernetes Administrator|CKA", "CISSP", "CISM", "CEH", "CompTIA Security+|Security+",
  "CompTIA A+", "CCNA", "Google Data Analytics Certificate", "Certified Scrum Master|CSM", "PMI-ACP", "PSM", "ITIL Foundation",
];

export const SOFT_SKILLS: string[] = [
  "Communication|Communication Skills|Communicate|Communicated", "Written Communication", "Verbal Communication", "Presentation Skills|Presenting",
  "Leadership|Leading", "Team Leadership", "People Management", "Mentoring|Mentor|Mentored|Mentorship", "Coaching", "Collaboration|Collaborate|Collaborated|Collaborative",
  "Teamwork|Team Player", "Cross-Functional|Cross-Functional Teams", "Stakeholder Management|Stakeholders|Stakeholder", "Problem Solving|Problem-Solving",
  "Critical Thinking", "Analytical Skills|Analytical", "Attention to Detail|Detail-Oriented|Detail Oriented", "Time Management",
  "Organisation|Organization|Organisational Skills|Organizational Skills", "Prioritisation|Prioritization", "Multitasking",
  "Adaptability|Adaptable", "Flexibility", "Creativity|Creative", "Innovation|Innovative", "Initiative", "Self-Motivated|Self-Starter",
  "Ownership", "Accountability", "Decision Making|Decision-Making", "Strategic Thinking", "Customer Focus|Customer-Focused|Customer-Centric",
  "Empathy", "Interpersonal Skills|Interpersonal", "Relationship Building", "Conflict Resolution", "Emotional Intelligence",
  "Resilience", "Work Ethic", "Integrity", "Influencing|Influence", "Facilitation", "Storytelling|Data Storytelling", "Curiosity",
  "Bilingual|Multilingual", "Fast-Paced|Fast Paced",
];

/** Words that never form keywords on their own. */
export const STOPWORDS = new Set(
  `a about above across after again against all also am an and any are as at be because been before being below between both but by can
  could did do does doing down during each either etc ever every few for from further had has have having he her here hers him his how i if
  in into is it its itself just least less like may me might more most must my no nor not now of off on once only or other our ours out over
  own per please same shall she should so some such than that the their theirs them then there these they this those through to too under
  until up upon us very via was we were what when where which while who whom why will with within without would you your yours
  ability able abilities across additional apply applicant applicants application benefit benefits bonus candidate candidates career careers
  company competitive culture day days degree desired environment equal employer employment excellent experience experienced experiences
  familiarity field full good great help high highly hire hiring ideal include includes including job join knowledge level looking make
  minimum new nice offer offers opportunity opportunities part people plus position preferred proven qualification qualifications related
  relevant required requirement requirements responsibilities responsibility role roles salary similar skill skills solid strong successful
  team teams time understanding using well work working world year years you'll we're we've you're what's who's role's based ability
  strong-willed will can't don't won't etc e.g i.e eg ie`
    .split(/\s+/)
    .filter(Boolean),
);
