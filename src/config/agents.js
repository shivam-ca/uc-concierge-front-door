// The one registry: the UI, the keyword router and the LLM prompt all read it, so they cannot drift apart.
export const CONFIDENCE_THRESHOLD = 0.6;

export const AGENTS = [
  {
    id: 'onboarding', name: 'Onboarding Agent', short: 'Onboarding', color: '#22d3ee', kind: 'live', version: 'v4 · Simple Finder',
    tagline: 'Finds the right form and the few steps to onboard a catalog, schema or Delta Share.',
    handles: 'Creating or onboarding a new Unity Catalog catalog, schema, volume, external location, Delta Share (inbound or outbound, including 84.51 shares), service principal or workspace onboarding; which request form to raise; onboarding steps and prerequisites.',
    examples: ['I want to create a new catalog', 'How do I onboard an inbound Delta Share from 84.51?', 'Which form do I use for a new schema?'],
    defaultUrl: 'http://127.0.0.1:8784/onboarding-agent',
  },
  {
    id: 'tracker', name: 'Tracker Agent', short: 'Tracker', color: '#f472b6', kind: 'live', version: 'v7 · Assistant',
    tagline: 'Turns Outlook and Teams requests into SME-approved tracker records.',
    handles: 'Finding emails or Teams messages (by sender, date, keyword, thread), logging or creating UC tracker records from requests, checking tracker status, work logged by the UC team, value metrics.',
    examples: ['Find the latest email about the catalog request', 'Log a tracker record for yesterday’s Teams request', 'Show tracker records opened this week'],
    defaultUrl: 'http://127.0.0.1:8765/v7',
  },
  {
    id: 'knowledge', name: 'Knowledge Agent', short: 'Knowledge', color: '#f3b76a', kind: 'live', version: 'Chat',
    tagline: 'Answers Unity Catalog questions from Confluence and Alation, with sources.',
    handles: 'General questions about Unity Catalog: naming standards, policies, how-to, concepts, permissions model, best practices, "what is" and "how does" questions answered from documentation.',
    examples: ['What are the catalog naming standards?', 'What is the difference between a managed and external table?', 'How do grants work in Unity Catalog?'],
    defaultUrl: 'http://127.0.0.1:8765/chat',
  },
  {
    id: 'ownership', name: 'Owner Agent', short: 'Ownership', color: '#4cd597', kind: 'live', version: 'Stale Owners',
    tagline: 'Checks that data assets have a valid, active owner, and flags stale ones.',
    handles: 'Who owns a data source, catalog or schema; stale, missing, anonymous or departed owners; ownership audits and validation; finding a replacement owner.',
    examples: ['Who owns the sales schema?', 'Show data sources with stale owners', 'Which catalogs have an owner who has left?'],
    defaultUrl: 'http://127.0.0.1:8766/stale-owners',
  },
  {
    id: 'access', name: 'Data Access Agent', short: 'Data Access', color: '#a78bfa', kind: 'soon', version: 'Coming soon',
    tagline: 'Finds the owner and APT role, checks IAM, and submits access requests with your consent.',
    handles: 'Requesting or granting access to data, tables, schemas, catalogs or external systems; APT roles; IAM permissions; "I need access to" requests.',
    examples: ['I need read access to the finance catalog', 'Which APT role gives me access to the sales tables?'],
    defaultUrl: null,
    interim: 'Until this agent is live, raise a standard data access request through the usual access request process, or ask the Knowledge Agent which role you need.',
  },
  {
    id: 'orchestrator', name: 'Orchestrator Agent', short: 'Orchestrator', color: '#8b84ff', kind: 'platform', version: 'This front door',
    tagline: 'Understands your request and routes it to the right specialist. It powers this page.',
    handles: '', examples: [], defaultUrl: null,
  },
  {
    id: 'validation', name: 'Shared Validation Service', short: 'Validation', color: '#7fb4ff', kind: 'platform', version: 'Platform service',
    tagline: 'Common checks the agents call (names, owners, entitlements). No UI of its own.',
    handles: '', examples: [], defaultUrl: null,
  },
];

export const ROUTABLE_IDS = AGENTS.filter(a => a.kind === 'live' || a.kind === 'soon').map(a => a.id);
export const getAgent = (id) => AGENTS.find(a => a.id === id);
