import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, MessageSquare, Filter, ArrowLeft } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchEmail, setSearchEmail] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();

      if (currentUser?.role !== 'super_admin') {
        navigate(createPageUrl('Home'));
        return;
      }

      setUser(currentUser);

      const bookings = await base44.entities.Booking.list('-created_date', 500);
      const withFeedback = bookings.filter(b => b.feedback_rating || b.feedback_comment);
      setFeedbackData(withFeedback);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = feedbackData
    .filter(item => {
      if (ratingFilter !== 'all') {
        const rating = parseInt(ratingFilter);
        return item.feedback_rating === rating;
      }
      return true;
    })
    .filter(item => {
      if (!searchEmail) return true;
      return item.user_email?.toLowerCase().includes(searchEmail.toLowerCase()) ||
        item.user_name?.toLowerCase().includes(searchEmail.toLowerCase());
    });

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.updated_date) - new Date(a.updated_date);
    } else if (sortBy === 'rating-high') {
      return (b.feedback_rating || 0) - (a.feedback_rating || 0);
    } else if (sortBy === 'rating-low') {
      return (a.feedback_rating || 0) - (b.feedback_rating || 0);
    }
    return 0;
  });

  const stats = {
    totalFeedback: feedbackData.length,
    avgRating: feedbackData.length > 0
      ? (feedbackData.reduce((sum, b) => sum + (b.feedback_rating || 0), 0) / feedbackData.length).toFixed(1)
      : 0
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const renderStars = (rating) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('AdminDashboard'))} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Therapist Feedback</h1>
      <p className="text-gray-500 mb-6">View and analyze ratings and feedback from massage sessions</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900">{stats.totalFeedback}</div>
            <div className="text-sm text-gray-500 mt-1">Total Feedback</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900">{stats.avgRating}</div>
            <div className="text-sm text-gray-500 mt-1">Average Rating</div>
            {renderStars(Math.round(stats.avgRating))}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Search by name or email..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className="flex-1"
        />
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="rating-high">Rating: High to Low</SelectItem>
            <SelectItem value="rating-low">Rating: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      {sortedData.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No feedback matches your filters</div>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedData.map((feedback) => (
            <Card key={feedback.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {feedback.user_name
                          ? feedback.user_name.split(' ').map(n => n[0]).join('').toUpperCase()
                          : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-gray-900">{feedback.user_name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{feedback.user_email}</div>
                    </div>
                  </div>
                  {feedback.feedback_rating && (
                    <div className="flex flex-col items-end gap-1">
                      {renderStars(feedback.feedback_rating)}
                      <span className="text-xs text-gray-500">{feedback.feedback_rating}/5</span>
                    </div>
                  )}
                </div>
                {feedback.feedback_comment && (
                  <p className="mt-3 text-gray-700 italic text-sm">"{feedback.feedback_comment}"</p>
                )}
                <div className="mt-3 flex gap-3 text-xs text-gray-400">
                  <span>{feedback.date}</span>
                  <span>{feedback.start_time} - {feedback.end_time}</span>
                  <Badge variant="outline" className="text-xs">{feedback.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}