import imgDelivery from '../../assets/avatars/illustration_avoid_deliveries.webp';
import imgReviews from '../../assets/avatars/illustration_collect_order.webp';

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
