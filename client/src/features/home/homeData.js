import chickenWraps from '../../assets/food/Grilled_Chicken_Wraps_and_Fresh_Salad_Bowl.webp';
import fettuccine from '../../assets/food/Creamy_Chicken_Fettuccine_with_Garlic_Bread.webp';
import paella from '../../assets/food/Vibrant_Seafood_Paella_Bowl.webp';
import fishBowl from '../../assets/food/Grilled_Fish_Rice_Bowl_with_Salsa.webp';
import teaScones from '../../assets/food/Rustic_Afternoon_Tea_with_Berry_Scones.webp';
import chickenDinner from '../../assets/food/Grilled_Chicken_Dinner_Platter.webp';
import teriyakiBowl from '../../assets/food/Glazed_Beef_Teriyaki_Rice_Bowl.webp';
import chickenWedges from '../../assets/food/Grilled_Chicken_Wrap_Platter_with_Potato_Wedges.webp';
import pennePasta from '../../assets/food/Creamy_Chicken_Penne_Pasta_Bowl.webp';
import salmonVeg from '../../assets/food/Grilled_Salmon_with_Rice_and_Roasted_Vegetables.webp';

import imgDelivery from '../../assets/avatars/illustration_avoid_deliveries.webp';
import imgReviews from '../../assets/avatars/illustration_collect_order.webp';

import imgBreakfast from '../../assets/vendors/cafeteria_breakfast.webp';
import imgEvening from '../../assets/vendors/campus_evening.webp';
import imgCourtyardParty from '../../assets/vendors/courtyard_party.webp';
import imgGrillHouse from '../../assets/vendors/grill_house.webp';
import imgLively from '../../assets/vendors/lively_courtyard.webp';
import imgDiningHall from '../../assets/vendors/dining_hall_buzz.webp';
import imgModernGathering from '../../assets/vendors/modern_gathering.webp';
import imgScienceBar from '../../assets/vendors/science_snack_bar.webp';
import heroPattern from '../../assets/heros/Pastel_Blue _Food_Doodle_Pattern.webp';

import adCombo from '../../assets/home_ads/Ultimate_Combo_for_Two.webp';
import adWraps from '../../assets/home_ads/Light_Meal_Combo_with_Wraps_and_Cola.webp';
import adCokeWings from '../../assets/home_ads/Ice_Cold_Coke_Wings_Combo.webp';
import adHalal from '../../assets/home_ads/Grilled_Halal_Chicken_Feast.webp';
import adCrispy from '../../assets/home_ads/Crispy_Fried_Chicken_Feast.webp';

import catHalal from '../../assets/food/Grilled_Salmon_with_Rice_and_Roasted_Vegetables.webp';
import catBreakfast from '../../assets/food/Rustic_Afternoon_Tea_with_Berry_Scones.webp';
import catDrinks from '../../assets/drinks/Refreshing_Slusher_with_Ice.webp';
import catQuick from '../../assets/food/Grilled_Chicken_Wrap_Platter_with_Potato_Wedges.webp';
import catHealthy from '../../assets/food/Grilled_Chicken_Wraps_and_Fresh_Salad_Bowl.webp';
import catPasta from '../../assets/food/Creamy_Chicken_Fettuccine_with_Garlic_Bread.webp';
import catSeafood from '../../assets/food/Vibrant_Seafood_Paella_Bowl.webp';
import catStudent from '../../assets/food/Grilled_Fish_Rice_Bowl_with_Salsa.webp';

export const vendors = [
  {
    id: 'main-campus-cafe',
    name: 'Main Campus Cafe',
    status: 'open',
    category: 'dining',
    description: 'Your go-to spot for fresh, hearty breakfasts between meetings.',
    walk_time: '6 min',
    estimated_prep_minutes: 15,
    average_rating: 4.5,
    rating_count: 128,
  },
  {
    id: 'library-bistro',
    name: 'Library Bistro',
    status: 'busy',
    category: 'dining',
    description: 'Comfort classics and pasta bowls, made fresh daily.',
    walk_time: '9 min',
    estimated_prep_minutes: 20,
    average_rating: 4.3,
    rating_count: 95,
  },
  {
    id: 'res-court-kitchen',
    name: 'Res Court Kitchen',
    status: 'open',
    category: 'seafood',
    description: 'Coastal-inspired bowls with a seasonal twist.',
    walk_time: '11 min',
    estimated_prep_minutes: 15,
    average_rating: 4.7,
    rating_count: 210,
  },
  {
    id: 'science-snack-bar',
    name: 'Science Snack Bar',
    status: 'closed',
    category: 'cafe',
    description: 'Quick bites, barista coffee and study-fuel snacks.',
    walk_time: '7 min',
    estimated_prep_minutes: 10,
    average_rating: 3.8,
    rating_count: 64,
  },
  {
    id: 'grill-house-court',
    name: 'Grill House Court',
    status: 'open',
    category: 'dining',
    description: 'Flame-grilled favourites served in the sunny courtyard.',
    walk_time: '8 min',
    estimated_prep_minutes: 18,
    average_rating: 4.6,
    rating_count: 175,
  },
  {
    id: 'dining-hall-central',
    name: 'Dining Hall Central',
    status: 'open',
    category: 'dining',
    description: 'The busiest hub on site — something for everyone.',
    walk_time: '5 min',
    estimated_prep_minutes: 12,
    average_rating: 4.2,
    rating_count: 300,
  },
  {
    id: 'east-gate-gather',
    name: 'East Gate Gathering',
    status: 'open',
    category: 'cafe',
    description: 'Modern café vibes with all-day brunch and smoothies.',
    walk_time: '12 min',
    estimated_prep_minutes: 14,
    average_rating: 4.4,
    rating_count: 88,
  },
  {
    id: 'courtyard-eats',
    name: 'Courtyard Eats',
    status: 'busy',
    category: 'dining',
    description: 'Open-air courtyard dining with rotating street-food stalls.',
    walk_time: '10 min',
    estimated_prep_minutes: 16,
    average_rating: 4.5,
    rating_count: 142,
  },
];

export const popularMeals = [
  { id: 'chicken-wrap', name: 'Chicken Wrap & Salad', price: 'R45', vendorId: 'main-campus-cafe', vendor: 'Main Campus Cafe', image: chickenWraps, bestSeller: true },
  { id: 'fish-bowl', name: 'Grilled Fish Rice Bowl', price: 'R52', vendorId: 'res-court-kitchen', vendor: 'Res Court Kitchen', image: fishBowl },
  { id: 'tea-scones', name: 'Tea & Berry Scones', price: 'R28', vendorId: 'east-gate-gather', vendor: 'East Gate Gathering', image: teaScones },
  { id: 'fettuccine', name: 'Creamy Chicken Fettuccine', price: 'R58', vendorId: 'library-bistro', vendor: 'Library Bistro', image: fettuccine, bestSeller: true },
  { id: 'paella', name: 'Seafood Paella Bowl', price: 'R64', vendorId: 'res-court-kitchen', vendor: 'Res Court Kitchen', image: paella, bestSeller: true },
  { id: 'chicken-dinner', name: 'Grilled Chicken Platter', price: 'R62', vendorId: 'grill-house-court', vendor: 'Grill House Court', image: chickenDinner },
  { id: 'teriyaki-bowl', name: 'Beef Teriyaki Rice Bowl', price: 'R56', vendorId: 'dining-hall-central', vendor: 'Dining Hall Central', image: teriyakiBowl },
  { id: 'chicken-wedges', name: 'Chicken Wrap & Wedges', price: 'R50', vendorId: 'grill-house-court', vendor: 'Grill House Court', image: chickenWedges },
  { id: 'penne-pasta', name: 'Creamy Chicken Penne', price: 'R54', vendorId: 'library-bistro', vendor: 'Library Bistro', image: pennePasta },
  { id: 'salmon-veg', name: 'Grilled Salmon & Veg', price: 'R68', vendorId: 'res-court-kitchen', vendor: 'Res Court Kitchen', image: salmonVeg, bestSeller: true },
];

export const deliveryImage = imgDelivery;
export const reviewsImage = imgReviews;
export const heroImage = heroPattern;

export const heroFoods = [
  { id: 'ad-combo', image: adCombo },
  { id: 'ad-wraps', image: adWraps },
  { id: 'ad-coke-wings', image: adCokeWings },
  { id: 'ad-halal', image: adHalal },
  { id: 'ad-crispy', image: adCrispy },
];

export const categories = [
  { id: 'halal', name: 'Halal', image: catHalal },
  { id: 'breakfast', name: 'Breakfast', image: catBreakfast },
  { id: 'drinks', name: 'Drinks', image: catDrinks },
  { id: 'quick-bites', name: 'Quick Bites', image: catQuick },
  { id: 'healthy', name: 'Healthy', image: catHealthy },
  { id: 'pasta', name: 'Pasta', image: catPasta },
  { id: 'seafood', name: 'Seafood', image: catSeafood },
  { id: 'team-faves', name: 'Team Faves', image: catStudent },
];

const REVIEW_ACCENTS = ['#0A8CFF', '#6366F1', '#10B981', '#F59E0B'];

export const reviews = [
  {
    id: 'r1',
    name: 'Thabo M.',
    role: '12 Aug 2026 · Library Bistro',
    text: 'Ordering before the lunch rush means I skip the entire queue. The food is always hot and ready when I arrive.',
    stars: 5,
    accent: REVIEW_ACCENTS[0],
  },
  {
    id: 'r2',
    name: 'Sarah K.',
    role: '10 Aug 2026 · Grill House Court',
    text: 'The variety is insane — I switch between the grill and the bistro every day. Never gets old.',
    stars: 5,
    accent: REVIEW_ACCENTS[1],
  },
  {
    id: 'r3',
    name: 'James N.',
    role: '8 Aug 2026 · Res Court Kitchen',
    text: 'Honestly the best workplace app we have. Saves me 15 minutes every single day. Worth it.',
    stars: 5,
    accent: REVIEW_ACCENTS[2],
  },
  {
    id: 'r4',
    name: 'Lerato P.',
    role: '5 Aug 2026 · Main Campus Cafe',
    text: 'The exclusive deals are a lifesaver on a tight budget. Highly recommend the meal combos.',
    stars: 4,
    accent: REVIEW_ACCENTS[3],
  },
];
