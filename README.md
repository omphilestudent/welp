# Welp - Employee Wellbeing Review Platform

Welp is a company review platform focused on employee experience and wellbeing, where employees can safely review companies, businesses can respond and improve, and psychologists can step in when reviews signal distress.

## Features

- **Three User Roles**: Employee, Psychologist, Business with distinct permissions
- **Anonymous Reviews**: Employees can post anonymously while maintaining internal accountability
- **24-Hour Edit/Delete**: Time-limited window for review modifications
- **Company Claim System**: Businesses can claim and manage their profiles
- **Private Messaging**: Secure communication between psychologists and employees
- **Real-time Chat**: WebSocket-based messaging system
- **Review Replies**: Both employees and businesses can reply to reviews
- **Search Functionality**: Full-text search for companies
- **Dark/Light Theme**: Toggle between dark and light modes

## Tech Stack

### Backend
- Node.js with Express
- PostgreSQL (Neon)
- JWT Authentication
- Socket.io for real-time messaging
- Rate limiting for security

### Frontend
- React with Vite
- Vanilla CSS with CSS variables
- React Router v6
- Context API for state management
- Axios for API calls
- Socket.io-client for real-time updates

## Project Structure
