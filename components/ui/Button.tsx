interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  href?: string
  onClick?: () => void
  className?: string
}

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  href,
  onClick,
  className = ''
}: ButtonProps) {
  const baseClasses = "font-bold rounded-xl transition-all inline-block text-center"
  
  const sizeClasses = {
    sm: "px-6 py-2 text-sm",
    md: "px-8 py-3 text-base",
    lg: "px-10 py-4 text-lg"
  }
  
  const variantClasses = {
    primary: "bg-primary text-white hover:opacity-90 disabled:opacity-50",
    secondary: "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50",
    success: "bg-success text-white hover:opacity-90 disabled:opacity-50"
  }
  
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`
  
  if (href) {
    return (
      <a 
        href={href}
        className={classes}
      >
        {children}
      </a>
    )
  }
  
  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
