import { FAQItem, TourStep } from './types';

// Merchant Dashboard FAQs
export const merchantFAQs: FAQItem[] = [
  // Orders Category
  {
    id: 'merchant-orders-1',
    question: 'How do I accept or reject incoming orders?',
    answer: 'In the Kitchen Orders tab, you\'ll see orders awaiting verification at the top. Click "Accept" to confirm the order and it will move to the prep queue, or click "Reject" if you cannot fulfill it. The patron will be notified immediately.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-2',
    question: 'How do I mark an order as ready for pickup?',
    answer: 'Once an order is prepared, click the "Mark Ready" button on the order card. This will notify the patron that their order is ready for collection and start a pickup timer.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-3',
    question: 'What happens if a patron doesn\'t collect their order?',
    answer: 'After the pickup deadline passes, you can mark the order as "No Show". This helps track patterns and the patron may receive reduced priority in the future.',
    category: 'Orders'
  },
  {
    id: 'merchant-orders-4',
    question: 'How do I extend the prep time for an order?',
    answer: 'Click the clock icon or "Extend" button on an order card. Select a reason for the delay and the new estimated time. The patron will be notified of the updated ETA.',
    category: 'Orders'
  },
  // Waitlist Category
  {
    id: 'merchant-waitlist-1',
    question: 'How do I manage the waitlist?',
    answer: 'The Waitlist tab shows all current waitlist entries. You can mark parties as "Ready" when their table is available, "Seated" once they\'re seated, or "No Show" if they don\'t respond.',
    category: 'Waitlist'
  },
  {
    id: 'merchant-waitlist-2',
    question: 'How do I add someone to the waitlist manually?',
    answer: 'Click the "Add to Waitlist" button in the Waitlist tab. Enter the guest\'s name, party size, phone number (optional), and any special preferences like seating area.',
    category: 'Waitlist'
  },
  {
    id: 'merchant-waitlist-3',
    question: 'What do the different waitlist statuses mean?',
    answer: 'Waiting = guest is in queue, Ready = table available and guest notified, Seated = guest has been seated, No Show = guest didn\'t respond within the deadline, Cancelled = guest cancelled their spot.',
    category: 'Waitlist'
  },
  // Reservations Category
  {
    id: 'merchant-reservations-1',
    question: 'How do I view and manage reservations?',
    answer: 'The Reservations tab shows a calendar view of all bookings. Click on any reservation to see details, modify it, or cancel if needed. Upcoming reservations automatically convert to waitlist entries.',
    category: 'Reservations'
  },
  {
    id: 'merchant-reservations-2',
    question: 'How do I set up tables for reservations?',
    answer: 'Go to Settings → Table Configuration to define your tables, their capacity, and any special features (e.g., patio, booth). This helps with auto-assignment of reservations.',
    category: 'Reservations'
  },
  // Settings Category
  {
    id: 'merchant-settings-1',
    question: 'How do I update business hours?',
    answer: 'Go to the Settings tab and look for "Business Hours". You can set different hours for each day of the week, and mark days as closed.',
    category: 'Settings'
  },
  {
    id: 'merchant-settings-2',
    question: 'How do I add staff members?',
    answer: 'In the Staff tab, click "Add Staff Member". Enter their email and assign a role (Admin or Staff). They\'ll receive an email invitation to set up their account.',
    category: 'Settings'
  },
  {
    id: 'merchant-settings-3',
    question: 'What\'s the difference between Admin and Staff roles?',
    answer: 'Admins can access all features including settings, staff management, and reports. Staff members can only manage orders and waitlist - they cannot change settings or view detailed analytics.',
    category: 'Settings'
  },
  // Reports Category
  {
    id: 'merchant-reports-1',
    question: 'How do I view my venue\'s performance?',
    answer: 'The Reports tab provides analytics on orders, waitlist efficiency, customer ratings, and more. You can filter by date range and export data as needed.',
    category: 'Reports'
  },
  {
    id: 'merchant-reports-2',
    question: 'Can I export my data?',
    answer: 'Yes! In the Reports tab, use the Export button to download your data as CSV or Excel files. You can export orders, waitlist entries, ratings, and customer analytics.',
    category: 'Reports'
  },
  // Notifications Category
  {
    id: 'merchant-notifications-1',
    question: 'How do notification sounds work?',
    answer: 'You\'ll hear different sounds for: new orders awaiting verification (continuous until handled), new waitlist entries, patron arrivals, and orders past due. Sounds can be configured in Settings.',
    category: 'Notifications'
  }
];

// Patron Dashboard FAQs
export const patronFAQs: FAQItem[] = [
  // Orders Category
  {
    id: 'patron-orders-1',
    question: 'How do I track my food order?',
    answer: 'Your active orders appear on the home screen. Each order shows its current status (Placed, In Prep, Ready) and estimated time. You\'ll receive a notification when it\'s ready.',
    category: 'Orders'
  },
  {
    id: 'patron-orders-2',
    question: 'What do the order statuses mean?',
    answer: 'Awaiting Verification = order submitted, Placed = confirmed by venue, In Prep = being prepared, Ready = ready for pickup, Collected = you\'ve picked it up.',
    category: 'Orders'
  },
  {
    id: 'patron-orders-3',
    question: 'How do I cancel my order?',
    answer: 'You can cancel an order before it moves to "In Prep" status. Tap on your order and select "Cancel Order". Once preparation begins, please speak with staff.',
    category: 'Orders'
  },
  // Waitlist Category
  {
    id: 'patron-waitlist-1',
    question: 'How do I join a waitlist?',
    answer: 'Scan the venue\'s QR code or use the "Join Waitlist" button. Enter your name, party size, and any seating preferences. You\'ll receive updates on your position and estimated wait time.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-2',
    question: 'What happens when my table is ready?',
    answer: 'You\'ll receive a notification and see "Table Ready" status. Head to the venue promptly - there\'s usually a deadline to claim your table before it\'s given to the next party.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-3',
    question: 'Can I leave the venue while waiting?',
    answer: 'Yes! That\'s the point. You\'ll be notified when your table is ready. Just make sure you can return within the deadline shown on your notification.',
    category: 'Waitlist'
  },
  {
    id: 'patron-waitlist-4',
    question: 'How do I delay my arrival?',
    answer: 'If you need more time, tap "I Need More Time" before the deadline. This pushes you back in line but keeps your spot. Use this if you\'re running late.',
    category: 'Waitlist'
  },
  // Reservations Category
  {
    id: 'patron-reservations-1',
    question: 'How do I make a reservation?',
    answer: 'Use the Reservations section to book a table in advance. Select the date, time, party size, and any preferences. You\'ll receive confirmation and reminders.',
    category: 'Reservations'
  },
  {
    id: 'patron-reservations-2',
    question: 'How do I modify or cancel a reservation?',
    answer: 'View your reservations in the app and tap on one to see options. You can modify details or cancel - please do so at least 2 hours before your reservation time.',
    category: 'Reservations'
  },
  // Profile Category
  {
    id: 'patron-profile-1',
    question: 'How do I update my profile?',
    answer: 'Tap on your profile in the app to update your name, phone number, and notification preferences.',
    category: 'Profile'
  },
  {
    id: 'patron-profile-2',
    question: 'How do notifications work?',
    answer: 'You can receive push notifications and SMS alerts for order updates and waitlist status. Enable these in your profile settings for the best experience.',
    category: 'Profile'
  },
  // Ratings Category
  {
    id: 'patron-ratings-1',
    question: 'How do I rate my experience?',
    answer: 'After your order is collected or you\'re seated, you\'ll see a rating prompt. Tap the stars to rate and optionally leave feedback. Your input helps venues improve!',
    category: 'Ratings'
  }
];

// ============================================================================
// MERCHANT TOUR STEPS - Comprehensive workflow with demo screens
// ============================================================================
export const merchantTourSteps: TourStep[] = [
  // Kitchen Orders Flow
  {
    id: 'merchant-demo-kitchen',
    target: '[data-tour="demo-kitchen-orders"]',
    title: '🍳 Kitchen Orders Dashboard',
    description: 'This is your main kitchen view. Orders flow through three stages: Awaiting Verification, In Preparation, and Ready for Pickup.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-kitchen',
    target: '[data-tour="demo-awaiting-verification"]',
    title: '⚠️ New Orders Need Attention',
    description: 'New orders appear here with an orange border and pulse animation. You must Accept or Reject each order. A continuous sound plays until you handle them.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'merchant-demo-kitchen',
    target: '[data-tour="demo-in-prep"]',
    title: '👨‍🍳 Orders Being Prepared',
    description: 'Accepted orders move here with countdown timers. Click "Mark Ready" when the order is prepared. You can extend the prep time if needed.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-kitchen',
    target: '[data-tour="demo-ready-orders"]',
    title: '✅ Ready for Pickup',
    description: 'Orders ready for collection appear here with a green border. The patron is notified. Click "Collected" when they pick up their order.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Waitlist Flow
  {
    id: 'merchant-demo-waitlist',
    target: '[data-tour="demo-merchant-waitlist"]',
    title: '👥 Waitlist Management',
    description: 'Manage your guest queue here. See who\'s waiting, their party size, and estimated wait times.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-waitlist',
    target: '[data-tour="demo-add-guest"]',
    title: '➕ Adding Guests Manually',
    description: 'Click here to add walk-in guests to the waitlist. Enter their name, party size, and any seating preferences.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'merchant-demo-waitlist',
    target: '[data-tour="demo-waiting-parties"]',
    title: '⏳ Waiting Parties Queue',
    description: 'Parties are shown in order. Click "Table Ready" to notify the guest when their table is available. They\'ll get a push notification!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-waitlist',
    target: '[data-tour="demo-ready-to-seat"]',
    title: '🎉 Ready to Seat',
    description: 'When a guest confirms they\'ve arrived, they appear here. Click "Seat Now" to complete the seating process.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Reservations
  {
    id: 'merchant-demo-reservations',
    target: '[data-tour="demo-reservations"]',
    title: '📅 Reservations Calendar',
    description: 'View and manage all reservations. See upcoming bookings, table assignments, and party sizes at a glance.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-reservations',
    target: '[data-tour="demo-reservation-list"]',
    title: '📋 Today\'s Bookings',
    description: 'Reservations are listed by time. Pending ones (yellow) need confirmation. 15 minutes before their time, they auto-convert to waitlist entries.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Staff Management
  {
    id: 'merchant-demo-staff',
    target: '[data-tour="demo-staff"]',
    title: '👨‍💼 Staff Management',
    description: 'Manage your team members and their access levels. Only Admins can access this section.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-staff',
    target: '[data-tour="demo-add-staff"]',
    title: '➕ Adding Team Members',
    description: 'Invite new staff by email. Choose their role: Admin (full access) or Staff (kitchen & waitlist only).',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'merchant-demo-staff',
    target: '[data-tour="demo-staff-list"]',
    title: '📋 Team Roster',
    description: 'View all team members, their roles, and manage permissions. Admins can remove staff or change roles.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Settings
  {
    id: 'merchant-demo-settings',
    target: '[data-tour="demo-settings"]',
    title: '⚙️ Venue Settings',
    description: 'Configure how your venue operates - hours, tables, notifications, and more.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-settings',
    target: '[data-tour="demo-business-hours"]',
    title: '🕐 Business Hours',
    description: 'Set your operating hours for each day. You can also add break times and mark days as closed.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-settings',
    target: '[data-tour="demo-table-config"]',
    title: '🪑 Table Configuration',
    description: 'Define your tables with names and capacities. This helps with auto-assignment of reservations.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-settings',
    target: '[data-tour="demo-notifications"]',
    title: '🔔 Notification Sounds',
    description: 'Configure alert sounds for new orders, waitlist entries, and patron arrivals. You can snooze sounds temporarily.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Reports
  {
    id: 'merchant-demo-reports',
    target: '[data-tour="demo-reports"]',
    title: '📊 Reports & Analytics',
    description: 'Track your venue\'s performance with detailed metrics and insights.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-reports',
    target: '[data-tour="demo-stats"]',
    title: '📈 Key Metrics',
    description: 'See today\'s orders, average ratings, prep times, and guest counts. Filter by date range for deeper analysis.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'merchant-demo-reports',
    target: '[data-tour="demo-export"]',
    title: '📥 Export Your Data',
    description: 'Download your data as CSV or Excel for external analysis or record-keeping.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Complete
  {
    id: 'merchant-demo-kitchen',
    target: '[data-tour="demo-kitchen-orders"]',
    title: '🎉 Tour Complete!',
    description: 'You\'re ready to manage your venue! Remember: tap the Help button anytime for FAQs, AI assistance, or to replay this tour.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
];

// ============================================================================
// PATRON TOUR STEPS - Comprehensive workflow with demo screens
// ============================================================================
export const patronTourSteps: TourStep[] = [
  // Food Order Flow
  {
    id: 'patron-demo-venue-select',
    target: '[data-tour="demo-venue-select"]',
    title: '🍔 Tracking Your Food Order',
    description: 'Let\'s walk through how to track a food order. First, you\'ll select the restaurant where you placed your order.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-venue-select',
    target: '[data-tour="demo-venue-search"]',
    title: '🔍 Search for Your Restaurant',
    description: 'Use the search bar to quickly find your restaurant. Results show distance so you can pick the right location.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-venue-select',
    target: '[data-tour="demo-venue-card"]',
    title: '📍 Select Your Venue',
    description: 'Tap on your restaurant to continue. The selected venue is highlighted with a border.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },

  {
    id: 'patron-demo-order-entry',
    target: '[data-tour="demo-order-entry"]',
    title: '🔢 Enter Your Order Number',
    description: 'Now enter the order number from your receipt. This is the POS number the cashier gave you.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-order-entry',
    target: '[data-tour="demo-order-input"]',
    title: '📝 Order Number Field',
    description: 'Type your order number here. It could be letters, numbers, or both (e.g., A42, 1234, XY89).',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-order-entry',
    target: '[data-tour="demo-track-button"]',
    title: '▶️ Start Tracking',
    description: 'Tap this button to submit your order. The kitchen will verify it and you\'ll start receiving updates!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },

  {
    id: 'patron-demo-order-tracking',
    target: '[data-tour="demo-order-tracking"]',
    title: '📱 Order Tracking Screen',
    description: 'Once your order is verified, you\'ll see this tracking screen with real-time updates.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-order-tracking',
    target: '[data-tour="demo-order-status"]',
    title: '🏷️ Order Status',
    description: 'The current status is shown prominently. It progresses: Awaiting Verification → Placed → In Prep → Ready.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-order-tracking',
    target: '[data-tour="demo-order-eta"]',
    title: '⏱️ Estimated Time',
    description: 'See exactly how long until your order is ready. This updates in real-time based on kitchen activity.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  {
    id: 'patron-demo-order-ready',
    target: '[data-tour="demo-order-ready"]',
    title: '🎉 Order Ready!',
    description: 'When your order is ready, you\'ll see this celebration screen with a sound notification!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-order-ready',
    target: '[data-tour="demo-collected-button"]',
    title: '✅ Confirm Collection',
    description: 'After picking up your order, tap this button. You\'ll have the option to rate your experience!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },

  // Waitlist Flow
  {
    id: 'patron-demo-waitlist-entry',
    target: '[data-tour="demo-waitlist-entry"]',
    title: '🍽️ Joining a Waitlist',
    description: 'Now let\'s see how to join a table waitlist. After selecting a venue, you\'ll enter your party details.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-waitlist-entry',
    target: '[data-tour="demo-party-name"]',
    title: '👤 Your Name',
    description: 'Enter the name for your party. This is how the host will call you.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-waitlist-entry',
    target: '[data-tour="demo-party-size"]',
    title: '👥 Party Size',
    description: 'Select how many people are in your party. This helps find an appropriately sized table.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-waitlist-entry',
    target: '[data-tour="demo-seating-pref"]',
    title: '🪑 Seating Preference',
    description: 'Choose your preferred seating area: Indoor, Outdoor, or No Preference.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-waitlist-entry',
    target: '[data-tour="demo-join-button"]',
    title: '▶️ Join the Waitlist',
    description: 'Tap here to join! You\'ll receive a position in the queue.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },

  {
    id: 'patron-demo-waitlist-status',
    target: '[data-tour="demo-waitlist-status"]',
    title: '📱 Waitlist Status',
    description: 'Once joined, you\'ll see your live position and estimated wait time.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-waitlist-status',
    target: '[data-tour="demo-position"]',
    title: '🔢 Your Position',
    description: 'Your position updates in real-time as guests ahead of you are seated.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-waitlist-status',
    target: '[data-tour="demo-wait-eta"]',
    title: '⏱️ Wait Estimate',
    description: 'The estimated wait time is calculated based on historical data and current activity.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  {
    id: 'patron-demo-table-ready',
    target: '[data-tour="demo-table-ready"]',
    title: '🎉 Table Ready!',
    description: 'When your table is ready, you\'ll see this celebration with a countdown timer!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
  {
    id: 'patron-demo-table-ready',
    target: '[data-tour="demo-countdown"]',
    title: '⏰ Countdown Timer',
    description: 'You have limited time to claim your table. The ring shows time remaining.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-table-ready',
    target: '[data-tour="demo-here-button"]',
    title: '✅ Confirm Arrival',
    description: 'Tap this when you arrive at the restaurant to let them know you\'re there.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
    highlightPulse: true,
  },
  {
    id: 'patron-demo-table-ready',
    target: '[data-tour="demo-more-time"]',
    title: '⏳ Need More Time?',
    description: 'Running late? Tap here to request more time. You\'ll be moved back in the queue but won\'t lose your spot entirely.',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },

  // Complete
  {
    id: 'patron-demo-venue-select',
    target: '[data-tour="demo-venue-select"]',
    title: '🎉 Tour Complete!',
    description: 'You\'re all set to use ReadyUp! Tap the Help button anytime for FAQs, AI chat, or to replay this tour. Enjoy dining without the wait!',
    placement: 'right',
    actionType: 'observe',
    nextStepTrigger: 'next-button',
  },
];

// FAQ Categories
export const merchantFAQCategories = ['Orders', 'Waitlist', 'Reservations', 'Settings', 'Reports', 'Notifications'];
export const patronFAQCategories = ['Orders', 'Waitlist', 'Reservations', 'Profile', 'Ratings'];

// System prompt for AI assistant
export const getMerchantSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, a restaurant management platform. You're helping a merchant (restaurant staff/owner) use the dashboard.

Key features you can help with:
- Kitchen Orders: Accept/reject orders, mark ready, track prep times
- Waitlist: Add guests, mark ready/seated, manage no-shows  
- Reservations: Calendar view, table assignment, automatic waitlist conversion
- Staff Management: Add/remove staff, assign admin or staff roles
- Settings: Business hours, table configuration, notification preferences
- Reports: Analytics, customer insights, data export

Navigation commands you can suggest:
- "kitchen" or "orders" → Kitchen Orders tab
- "waitlist" → Waitlist tab  
- "reservations" → Reservations tab
- "staff" → Staff Management tab
- "settings" → Settings tab
- "reports" → Reports tab

Keep responses concise and actionable. If you suggest navigating somewhere, include the action in your response.
When the user asks how to do something, give clear step-by-step instructions.`;

export const getPatronSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, helping customers track orders and manage waitlist entries.

Key features you can help with:
- Order Tracking: See order status, estimated times, pickup notifications
- Waitlist: Join waitlist, track position, respond when table ready
- Reservations: Book tables, modify/cancel reservations
- Profile: Update contact info, notification preferences
- Ratings: Rate your experience after visits

Navigation commands you can suggest:
- "home" → Main tracking view
- "food" or "orders" → Food Ready section
- "table" or "waitlist" → Table Ready section  
- "profile" → Profile settings

Keep responses friendly and helpful. If something requires staff assistance, let them know.
When explaining status meanings, be clear about what the customer should do next.`;
