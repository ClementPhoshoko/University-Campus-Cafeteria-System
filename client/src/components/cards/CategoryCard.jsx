import { useNavigate } from 'react-router-dom';
import './CategoryCard.css';

export default function CategoryCard({ id, name, image, filterId }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (filterId) {
      navigate(`/cafeterias?filter=${filterId}`);
    }
  };

  return (
    <div key={id} className="home_category-card" onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
      <img src={image} alt={name} loading="lazy" />
      <div className="home_category-fade" />
      <span className="home_category-name">{name}</span>
    </div>
  );
}
