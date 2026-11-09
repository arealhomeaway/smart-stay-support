# src/components/direct-bookings rules
- Direct Bookings map: only src/components/direct-bookings/SearchMap.tsx knows the map provider (Leaflet + OpenStreetMap, dynamically imported in the browser); provider-neutral rules (rings, labels, pin spreading, failure) live in src/lib/search-map.ts. Why: a provider switch changes one file.
