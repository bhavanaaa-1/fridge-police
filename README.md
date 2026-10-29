# FridgePolice

A shared-fridge inventory and food coordination application that helps people manage food availability, request portions, prevent over-allocation, and keep inventory records accurate.

## Features

- **Inventory Management:** View food items, quantities, and availability.
- **Food Requests:** Request portions of available items.
- **Request Approval:** Approve or reject requests while preventing multiple approvals from exceeding available quantities.
- **Reservation Expiry:** Simulate expired reservations and release reserved portions.
- **Inventory Corrections:** Record food that has been consumed, gone missing, or spoiled.
- **Activity Log:** Maintain a record of inventory corrections and important actions.
- **Local Persistence:** Store application data using browser local storage.

## Tech Stack

- React
- Vite
- JavaScript
- CSS
- Browser Local Storage

## Getting Started

### Prerequisites

Install [Node.js](https://nodejs.org/).

### Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
```

Navigate to the project directory:

```bash
cd FridgePolice
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in your terminal.

## Production Build

To create a production build, run:

```bash
npm run build
```

## Data Storage

FridgePolice currently uses browser local storage to persist application data. It does not currently use a shared backend database, so data is stored locally in the browser.

## Project Purpose

FridgePolice aims to make shared-fridge coordination more reliable by improving inventory visibility, managing food requests, and recording changes to food availability.
