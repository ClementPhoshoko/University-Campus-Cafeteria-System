import { useNavigate } from 'react-router-dom';
import './CategoryCard.css';
import SmartImage from '../ui/SmartImage.jsx';

export default function CategoryCard({ id, name, image, filterId }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (filterId) {
      navigate(`/cafeterias?filter=${filterId}`);
    }
  };

  return (
    <div key={id} className="home_category-card" onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
      <SmartImage src={image} alt={name} width={150} height={110} />
      <div className="home_category-fade" />
      <span className="home_category-name">{name}</span>
    </div>
  );
}
