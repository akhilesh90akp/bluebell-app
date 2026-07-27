/**
 * Data Constants - Application reference data
 *
 * Contains all static data used across the application including
 * event types, service categories, default company settings, and SAC codes.
 */

/** Available event types for classification */
export const EVENT_TYPES = [
  'Wedding', 'Reception', 'Engagement', 'Birthday Party', 'Anniversary',
  'Corporate Event', 'Conference', 'House Warming', 'Baby Shower',
  'Religious Event', 'Government Event', 'College Event', 'Other',
];

/**
 * Default service categories with predefined items.
 * Each category has an id, display name, emoji icon, and list of service items.
 */
export const DEFAULT_CATEGORIES = [
  { id: 'decor', name: 'Decor & Setup', icon: '🎨', items: ['Wedding Stage Decor','Reception Stage Decor','Mandap Setup','Flower Decoration (Fresh)','Flower Decoration (Artificial)','Gate / Entrance Arch','Pathway Decoration','Backdrop / Photo Wall','Balloon Decoration','Car Decoration','Panthal / Pandal Setup','Ceiling Draping'] },
  { id: 'lighting', name: 'Lighting', icon: '💡', items: ['Stage Lights (LED/Par)','Fairy / String Lights','Chandeliers','Laser Lights','Moving Head Lights','LED Wall / Screen','Spotlight','Truss with Lights','Neon Signs'] },
  { id: 'sound', name: 'Sound & DJ', icon: '🔊', items: ['DJ System (with DJ)','PA System','Wireless Microphones','Speakers (Floor)','Speakers (Hanging)','Mixer / Amplifier','Musical Band','Karaoke Setup'] },
  { id: 'power', name: 'Power & Generator', icon: '⚡', items: ['Generator 25 KVA','Generator 50 KVA','Generator 75 KVA','Generator 100 KVA','Generator 125 KVA','UPS Backup','Electrical Wiring'] },
  { id: 'catering', name: 'Catering', icon: '🍽️', items: ['Vegetarian Menu','Non-Vegetarian Menu','Buffet Setup','Live Cooking Stations','Bar / Mocktail Counter','Tea / Coffee Station','Custom Cake','Service Staff'] },
  { id: 'photography', name: 'Photography & Video', icon: '📸', items: ['Photographer','Videographer','Drone Coverage','Pre-wedding Shoot','Album (Physical)','Album (Digital)','Photo Booth','Live Streaming'] },
  { id: 'venue', name: 'Venue & Logistics', icon: '🏛️', items: ['Venue Booking','Tent / Shamiyana','Chairs (Chiavari)','Chairs (Cushion)','Chairs (Plastic)','Tables (Round)','Tables (Rectangle)','Sofa Seating','Red Carpet','AC / Cooler','Portable Washrooms'] },
  { id: 'entertainment', name: 'Entertainment', icon: '🎭', items: ['Anchor / Emcee','Dance Troupe','Fireworks','Dhol / Band','Magician','Kids Zone'] },
  { id: 'transport', name: 'Transportation', icon: '🚗', items: ['Bridal Car','Guest Shuttle / Bus','Palki / Horse'] },
  { id: 'misc', name: 'Miscellaneous', icon: '📋', items: ['Valet Parking','Security Personnel','First Aid Staff','Event Coordinator','Makeup Artist','Mehndi Artist','Priest / Pandit'] },
];

/** Default company/business settings used on first launch */
export const DEFAULT_SETTINGS = {
  companyName: 'BLUE BELL',
  tagline: 'Event Planners LLP',
  address: '297/6, Keerikkattil, Karukappilly PO,\nKolenchery, Ernakulam,\nKerala, 682311',
  gstin: '32BEIPJ1543N1ZH',
  pan: 'BEIPJ1543N',
  phone: '9048695905',
  whatsapp: '9048695905',
  email: '',
  logo: null,
  bankDetails: {
    accountName: 'BLUE BELL',
    accountNo: '10110200016074',
    bankName: 'Federal Bank',
    branch: 'Kolenchery Branch',
    ifscCode: 'FDRL0001011',
    upiId: '',
  },
  invoicePrefix: 'BB',
  defaultGstRate: 18,
  termsAndConditions: [
    'Total payment due in 30 days',
    'Please include the invoice number on your check',
  ],
  thankYouMessage: 'Thank You For Your Business!',
};

/** SAC (Services Accounting Code) for event management services */
export const DEFAULT_SAC_CODE = '998596';
