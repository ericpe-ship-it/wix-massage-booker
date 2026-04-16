import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Calendar, CheckCircle, Clock, Star, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    icon: <Calendar className="w-8 h-8 text-indigo-500" />,
    title: "1. Choose a Date",
    description: "Head to the Book page to see upcoming massage dates. Only dates activated by the admin will be available for booking.",
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-indigo-500" />,
    title: "2. Pick a Time Slot & Confirm",
    description: "Select an open 13-minute slot that works for you. Review and confirm your booking — it will instantly appear under My Bookings.",
  },
  {
    icon: <Bell className="w-8 h-8 text-indigo-500" />,
    title: "3. Get Reminders",
    description: "You'll receive a Google Calendar event and Slack reminders the day before and an hour before your session so you never miss it.",
  },
  {
    icon: <Clock className="w-8 h-8 text-indigo-500" />,
    title: "4. Day-of Confirmation",
    description: "On the day of your massage, confirm your attendance between 5am and 30 minutes before your time slot. If you don't confirm, your booking will be cancelled and offered to the waitlist.",
  },
  {
    icon: <Star className="w-8 h-8 text-indigo-500" />,
    title: "5. Leave Feedback",
    description: "After your session, you can rate your experience and leave a comment from the My Bookings page.",
  },
];

export default function HowItWorks() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h1>
        <p className="text-gray-600 text-lg mb-6">
          Everything you need to know about booking your chair massage session at the Wix Cedar Rapids office.
        </p>
        <Link to={createPageUrl('Book')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Book a Slot</Button>
        </Link>
      </div>

      {/* Steps */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Booking Steps</h2>
        <div className="flex flex-col gap-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex-shrink-0">{step.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="bg-indigo-50 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">📍 Location</h2>
        <p className="text-gray-700 font-medium">Wix Cedar Rapids — Library</p>
        <p className="text-gray-500 text-sm mt-1">Sessions are held every 2 weeks · 13-minute slots</p>
      </div>
    </div>
  );
}