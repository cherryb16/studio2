# **App Name**: Trade Insights Pro

## Core Features:

- User Authentication: Secure user authentication with Firebase (email/password and Google Sign-In) managed by a custom 'useAuth' hook.
- Dashboard Layout and Visualization: Dashboard layout with sidebar navigation and main content area, displaying key metrics in cards and Recharts/ShadCN charts.
- Trade Management: Trades table that show the trades, including ability to manually add, edit, and remove trade entries. Sorting enabled.
- Journaling: Journal page presenting entries as cards, with a dialog to add new entries linked to trades.
- AI-Powered Journaling Assistant: AI-powered flow that acts as a trading assistant that analyzes the provided data, and then uses that tool to suggest prompts when linking a journal entry to a trade. The suggestion is displayed as clickable buttons that insert the suggested prompts to the user's notes. This feature uses generative AI.
- Brokerage Integration: Connect to a user's brokerage accounts via the SnapTrade API. The UI action gets a redirect URL from SnapTrade, first registering the user (using their Firebase UID as the SnapTrade User ID) with SnapTrade and then navigates the user's browser to the response URL (the SnapTrade Connection Portal) to allow the user to connect their brokerage account.

## Style Guidelines:

- Primary color: Dark blue (#34495e) for a professional and trustworthy feel, reflecting stability and expertise.
- Background color: Very light gray (#f0f2f5) to provide a clean, neutral backdrop that enhances readability and focus.
- Accent color: Teal (#1abc9c) for interactive elements and highlights, providing a modern and engaging contrast.
- Headings font: 'Space Grotesk' (sans-serif) for a modern, slightly techy and clear headline.
- Body font: 'Inter' (sans-serif) for a neutral, very readable and clean text body.
- lucide-react icons to be used throughout the UI. They are simple and effective
- ShadCN UI components to create a consistent UI layout, so the main pages (Dashboard, Trades and Journal) have a similar construction for the various items that may be present. Follow a grid-based system.