import { Business, Website, DeploymentLog, ChartDataPoint } from './types';

export const MOCK_BUSINESSES: Business[] = [
  {
    id: 'b1',
    business_name: 'Apex Plumbing Solutions',
    business_type: 'Plumber',
    phone: '(555) 123-4567',
    email: 'contact@apexplumbing.com',
    address_street: '123 Market St',
    address_city: 'Seattle',
    address_state: 'WA',
    description: 'Premier plumbing services for residential and commercial properties in the greater Seattle area.',
    services: ['Leak Repair', 'Pipe Installation', 'Water Heater Repair'],
    target_keywords: ['emergency plumber seattle', 'water heater repair', 'clogged drain fix'],
    created_at: '2023-10-01T12:00:00Z'
  },
  {
    id: 'b2',
    business_name: 'Elite Legal Group',
    business_type: 'Law Firm',
    phone: '(555) 987-6543',
    email: 'info@elitelegal.com',
    address_street: '450 Lexington Ave',
    address_city: 'New York',
    address_state: 'NY',
    description: 'Experienced attorneys specializing in corporate law and estate planning.',
    services: ['Corporate Law', 'Estate Planning', 'Litigation'],
    target_keywords: ['corporate lawyer nyc', 'estate planning attorney', 'business litigation'],
    created_at: '2023-10-05T15:30:00Z'
  }
];

export const MOCK_WEBSITES: Website[] = [
  {
    id: 'w1',
    business_id: 'b1',
    name: 'Apex Plumbing Seattle',
    slug: 'apex-plumbing-seattle',
    domain: 'apexplumbing.com',
    status: 'deployed',
    template: 'modern',
    location_count: 12,
    service_count: 5,
    last_deployed_at: '2023-10-25T14:30:00Z',
    created_at: '2023-10-20T10:00:00Z'
  },
  {
    id: 'w2',
    business_id: 'b1',
    name: 'Apex Plumbing Eastside',
    slug: 'apex-plumbing-eastside',
    domain: 'apexeastside.com',
    status: 'generating',
    template: 'bold',
    location_count: 8,
    service_count: 5,
    last_deployed_at: undefined,
    created_at: '2023-10-26T09:15:00Z'
  },
  {
    id: 'w3',
    business_id: 'b2',
    name: 'Elite Legal NYC',
    slug: 'elite-legal-nyc',
    domain: undefined,
    status: 'draft',
    template: 'professional',
    location_count: 1,
    service_count: 3,
    last_deployed_at: undefined,
    created_at: '2023-10-27T11:45:00Z'
  }
];

export const RECENT_LOGS: DeploymentLog[] = [
  { id: 'l1', status: 'success', step: 'DNS Propagation', started_at: '2023-10-27T10:00:00Z', message: 'DNS records verified successfully.' },
  { id: 'l2', status: 'deploying', step: 'Building Container', started_at: '2023-10-27T09:55:00Z', message: 'Building Docker image for w2...' },
  { id: 'l3', status: 'success', step: 'Content Generation', started_at: '2023-10-27T08:30:00Z', message: 'Generated 12 location pages for w1.' },
];

export const TRAFFIC_DATA: ChartDataPoint[] = [
  { name: 'Mon', value: 2400 },
  { name: 'Tue', value: 1398 },
  { name: 'Wed', value: 9800 },
  { name: 'Thu', value: 3908 },
  { name: 'Fri', value: 4800 },
  { name: 'Sat', value: 3800 },
  { name: 'Sun', value: 4300 },
];