import imgDelivery from '../../assets/avatars/illustration_avoid_deliveries.webp';
import imgReviews from '../../assets/avatars/illustration_collect_order.webp';

import heroPattern from '../../assets/heros/Pastel_Blue _Food_Doodle_Pattern.webp';

import adCombo from '../../assets/home_ads/Ultimate_Combo_for_Two.webp';
import adWraps from '../../assets/home_ads/Light_Meal_Combo_with_Wraps_and_Cola.webp';
import adCokeWings from '../../assets/home_ads/Ice_Cold_Coke_Wings_Combo.webp';
import adHalal from '../../assets/home_ads/Grilled_Halal_Chicken_Feast.webp';
import adCrispy from '../../assets/home_ads/Crispy_Fried_Chicken_Feast.webp';

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
