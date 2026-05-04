# GlobeTrek
> A comprehensive travel and tour management platform connecting travelers, tour partners, and administrators.

## Overview
GlobeTrek is an integrated web platform designed to streamline the process of booking and managing travel experiences. It serves three main audiences: End Users (travelers looking for tours), Partners (agencies or individuals providing tours), and Administrators (system managers). The system handles everything from tour discovery and booking to payment processing and revenue tracking.

## Features

**Traveler (User) Features**
* **Tour Discovery:** Browse, search, and filter destinations and available tours.
* **Booking & Payments:** Book tours securely with integrated PayPal and Stripe payment gateways.
* **Favorites:** Save tours to a personalized favorites list for future reference.
* **Reviews & Ratings:** Leave feedback on completed tours.

**Partner Features**
* **Tour Management:** Create, edit, and manage tour offerings.
* **Order Tracking:** View and manage bookings specific to the partner's tours.
* **Revenue Dashboard:** Track daily, monthly, and yearly earnings, including visual charts.

**Admin Features**
* **System Oversight:** Manage users, partners, and user roles.
* **Content Moderation:** Approve, edit, or delete tours, destinations, and tour types across the platform.
* **Global Revenue Tracking:** Monitor overall system transactions and platform revenue.

## Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB (via Mongoose), Redis (via ioredis) for caching/session management
* **Authentication:** JWT (JSON Web Tokens), bcryptjs
* **Views/Template Engine:** EJS (Embedded JavaScript templating)
* **External Services:** 
  * Payments: PayPal Checkout SDK, Stripe
  * Storage: Cloudinary (for image uploads via Multer)
  * Email: Mailtrap / Nodemailer
* **Deployment/Environment:** Requires Node running `nodemon` for local development.

## Architecture

GlobeTrek follows a classic **MVC (Model-View-Controller)** architecture to separate concerns clearly:
* **Models:** Define MongoDB schemas for Users, Tours, Orders, Revenues, Transactions, etc.
* **Controllers:** Contains the business logic, organized by role (`Admin/`, `Partner/`, external users).
* **Routes:** Route definitions mapping HTTP requests to corresponding controllers.
* **Services:** Reusable logic sets for CRUD operations, Token handling, and Email templating.
* **Views:** EJS templates for server-side rendering of dashboards and user interfaces.

## API & Routing Overview

While the application primarily serves server-rendered EJS pages for dashboards, the routing structure implies a REST-like organization.

* **Base routes:** `/auth`, `/tours`, `/orders`, `/destinations`
* **Admin routes:** `/admin/tours`, `/admin/users`, `/admin/revenue`
* **Partner routes:** `/partner/tours`, `/partner/orders`, `/partner/revenue`
* **Authentication:** Handled via JWT stored in HTTP-only cookies and Authorization headers.

## Installation & Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd GlobeTrek
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
Duplicate `.env.example` (if present) or create a `.env` file in the root directory. Configure your database and third-party keys.

4. **Run the project locally**
```bash
npm start
```
*Note: `npm start` uses `nodemon server.js` for hot-reloading during development.*

## Environment Variables

Key variables required in your `.env` file:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string

# Authentication
JWT_SECRET=your_jwt_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Payments
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
STRIPE_SECRET_KEY=

# Email (Mailtrap)
MAILTRAP_USER=
MAILTRAP_PASS=
```

## Project Structure

```
src/
 ├── config/            # External service and DB configurations
 ├── controllers/       # Route controllers (split by Admin, Partner, etc.)
 ├── Middleware/        # Auth, availability, and image upload middlewares
 ├── models/            # Mongoose schemas (Tour, User, Order, Revenue, etc.)
 ├── public/            # Static assets (CSS, images)
 ├── routes/            # Application routing logic
 ├── service/           # Helper services (Mailtrap, CRUD, Tokens)
 └── views/             # EJS view templates
```

## Future Improvements

* **API Decoupling:** Fully separate the backend into a strict REST or GraphQL API and migrate the frontend to a modern SPA framework (React/Vue).
* **Dockerization:** Add a `Dockerfile` and `docker-compose.yml` to spin up the Node app, MongoDB, and Redis simultaneously.
* **Advanced Caching:** Expand Redis usage to cache query-heavy endpoints (like search and destination filtering) for better performance.
* **Automated Testing:** Implement unit and integration tests using Jest or Mocha/Chai to ensure reliability across roles.
