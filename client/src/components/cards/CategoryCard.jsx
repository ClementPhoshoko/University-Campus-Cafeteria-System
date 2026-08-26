import './CategoryCard.css';

export default function CategoryCard({ id, name, image }) {
  return (
    <div key={id} className="home_category-card">
      <img src={image} alt={name} loading="lazy" />
      <div className="home_category-fade" />
      <span className="home_category-name">{name}</span>
    </div>
  );
}
