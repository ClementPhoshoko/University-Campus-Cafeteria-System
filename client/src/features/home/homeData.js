import chickenWraps from '../../assets/food/Grilled_Chicken_Wraps_and_Fresh_Salad_Bowl.png';
import fettuccine from '../../assets/food/Creamy_Chicken_Fettuccine_with_Garlic_Bread.png';
import paella from '../../assets/food/Vibrant_Seafood_Paella_Bowl.png';
import fishBowl from '../../assets/food/Grilled_Fish_Rice_Bowl_with_Salsa.png';
import teaScones from '../../assets/food/Rustic_Afternoon_Tea_with_Berry_Scones.png';
import chickenDinner from '../../assets/food/Grilled_Chicken_Dinner_Platter.png';
import teriyakiBowl from '../../assets/food/Glazed_Beef_Teriyaki_Rice_Bowl.png';
import chickenWedges from '../../assets/food/Grilled_Chicken_Wrap_Platter_with_Potato_Wedges.png';
import pennePasta from '../../assets/food/Creamy_Chicken_Penne_Pasta_Bowl.png';
import salmonVeg from '../../assets/food/Grilled_Salmon_with_Rice_and_Roasted_Vegetables.png';

import imgDelivery from '../../assets/avatars/illustration_avoid_deliveries.png';
import imgReviews from '../../assets/avatars/illustration_collect_order.png';

import imgBreakfast from '../../assets/cafeterias/cafeteria_breakfast.png';
import imgEvening from '../../assets/cafeterias/campus_evening.png';
import imgCourtyardParty from '../../assets/cafeterias/courtyard_party.png';
import imgGrillHouse from '../../assets/cafeterias/grill_house.png';
import imgLively from '../../assets/cafeterias/lively_courtyard.png';
import imgDiningHall from '../../assets/cafeterias/dining_hall_buzz.png';
import imgModernGathering from '../../assets/cafeterias/modern_gathering.png';
import imgScienceBar from '../../assets/cafeterias/science_snack_bar.png';
import heroPattern from '../../assets/heros/Pastel_Blue _Food_Doodle_Pattern.png';

import adCombo from '../../assets/home_ads/Ultimate_Combo_for_Two.png';
import adWraps from '../../assets/home_ads/Light_Meal_Combo_with_Wraps_and_Cola.png';
import adCokeWings from '../../assets/home_ads/Ice_Cold_Coke_Wings_Combo.png';
import adHalal from '../../assets/home_ads/Grilled_Halal_Chicken_Feast.png';
import adCrispy from '../../assets/home_ads/Crispy_Fried_Chicken_Feast.png';

import catHalal from '../../assets/food/Grilled_Salmon_with_Rice_and_Roasted_Vegetables.png';
import catBreakfast from '../../assets/food/Rustic_Afternoon_Tea_with_Berry_Scones.png';
import catDrinks from '../../assets/drinks/Refreshing_Slusher_with_Ice.png';
import catQuick from '../../assets/food/Grilled_Chicken_Wrap_Platter_with_Potato_Wedges.png';
import catHealthy from '../../assets/food/Grilled_Chicken_Wraps_and_Fresh_Salad_Bowl.png';
import catPasta from '../../assets/food/Creamy_Chicken_Fettuccine_with_Garlic_Bread.png';
import catSeafood from '../../assets/food/Vibrant_Seafood_Paella_Bowl.png';
import catStudent from '../../assets/food/Grilled_Fish_Rice_Bowl_with_Salsa.png';

export const cafeterias = [
  {
    id: 'main-campus-cafe',
    name: 'Main Campus Cafe',
    status: 'open',
    theme: 'blue',
    image: imgBreakfast,
    category: 'dining',
    description: 'Your go-to spot for fresh, hearty breakfasts between meetings.',
    walkTime: '6 min',
    prepWindow: '10–15 min',
  },
  {
    id: 'library-bistro',
    name: 'Library Bistro',
    status: 'busy',
    theme: 'coral',
    image: imgLively,
    category: 'dining',
    description: 'Comfort classics and pasta bowls, made fresh daily.',
    walkTime: '9 min',
    prepWindow: '15–20 min',
  },
  {
    id: 'res-court-kitchen',
    name: 'Res Court Kitchen',
    status: 'open',
    theme: 'mint',
    image: imgEvening,
    category: 'seafood',
    description: 'Coastal-inspired bowls with a seasonal twist.',
    walkTime: '11 min',
    prepWindow: '10–15 min',
  },
  {
    id: 'science-snack-bar',
    name: 'Science Snack Bar',
    status: 'closed',
    theme: 'blue',
    image: imgScienceBar,
    category: 'cafe',
    description: 'Quick bites, barista coffee and study-fuel snacks.',
    walkTime: '7 min',
    prepWindow: '5–10 min',
  },
  {
    id: 'grill-house-court',
    name: 'Grill House Court',
    status: 'open',
    theme: 'coral',
    image: imgGrillHouse,
    category: 'dining',
    description: 'Flame-grilled favourites served in the sunny courtyard.',
    walkTime: '8 min',
    prepWindow: '12–18 min',
  },
  {
    id: 'dining-hall-central',
    name: 'Dining Hall Central',
    status: 'open',
    theme: 'mint',
    image: imgDiningHall,
    category: 'dining',
    description: 'The busiest hub on site — something for everyone.',
    walkTime: '5 min',
    prepWindow: '8–12 min',
  },
  {
    id: 'east-gate-gather',
    name: 'East Gate Gathering',
    status: 'open',
    theme: 'blue',
    image: imgModernGathering,
    category: 'cafe',
    description: 'Modern café vibes with all-day brunch and smoothies.',
    walkTime: '12 min',
    prepWindow: '8–14 min',
  },
  {
    id: 'courtyard-eats',
    name: 'Courtyard Eats',
    status: 'busy',
    theme: 'coral',
    image: imgCourtyardParty,
    category: 'dining',
    description: 'Open-air courtyard dining with rotating street-food stalls.',
    walkTime: '10 min',
    prepWindow: '12–16 min',
  },
];

export const popularMeals = [
  { id: 'chicken-wrap', name: 'Chicken Wrap & Salad', price: 'R45', vendor: 'Main Campus Cafe', image: chickenWraps, bestSeller: true },
  { id: 'fish-bowl', name: 'Grilled Fish Rice Bowl', price: 'R52', vendor: 'Res Court Kitchen', image: fishBowl },
  { id: 'tea-scones', name: 'Tea & Berry Scones', price: 'R28', vendor: 'East Gate Gathering', image: teaScones },
  { id: 'fettuccine', name: 'Creamy Chicken Fettuccine', price: 'R58', vendor: 'Library Bistro', image: fettuccine, bestSeller: true },
  { id: 'paella', name: 'Seafood Paella Bowl', price: 'R64', vendor: 'Res Court Kitchen', image: paella, bestSeller: true },
  { id: 'chicken-dinner', name: 'Grilled Chicken Platter', price: 'R62', vendor: 'Grill House Court', image: chickenDinner },
  { id: 'teriyaki-bowl', name: 'Beef Teriyaki Rice Bowl', price: 'R56', vendor: 'Dining Hall Central', image: teriyakiBowl },
  { id: 'chicken-wedges', name: 'Chicken Wrap & Wedges', price: 'R50', vendor: 'Grill House Court', image: chickenWedges },
  { id: 'penne-pasta', name: 'Creamy Chicken Penne', price: 'R54', vendor: 'Library Bistro', image: pennePasta },
  { id: 'salmon-veg', name: 'Grilled Salmon & Veg', price: 'R68', vendor: 'Res Court Kitchen', image: salmonVeg, bestSeller: true },
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
