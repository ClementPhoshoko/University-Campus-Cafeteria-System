export default function Skeleton({ className = '', style, ...props }) {
  const classes = ['skeleton', className].filter(Boolean).join(' ');
  return <span className={classes} style={style} {...props} />;
}
