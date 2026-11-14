import {
  Baby, Beer, Bike, BookOpen, Briefcase, Bus, Car, CircleDashed, Clapperboard, Coffee, CreditCard, Droplet, Dumbbell, Fuel,
  Gamepad2, Gift, GraduationCap, HandHeart, Heart, House, Landmark, Lightbulb, Music, PawPrint, PiggyBank, Pill, Pizza, Plane,
  Receipt, Scissors, Grape, Cherry, Tractor, Fence, Carrot, Warehouse, Apple, Banana, Citrus, Megaphone, CalendarClock, Compass, Mountain, UserCheck, Sprout, Wheat, Hammer, Shapes, Shirt, ShoppingCart, Smartphone, Sofa, Sparkles, Stethoscope, Tag, Tent, TreePalm, Tv, Users,
  UtensilsCrossed, Wifi, Wrench, Zap, HardHat, Shovel,
} from 'lucide-react';

/** Íconos que se pueden elegir para una categoría (el nombre es lo que se guarda en el servidor). */
export const ICONOS = {
  ShoppingCart, UtensilsCrossed, Coffee, Pizza, Beer, Car, Bus, Fuel, Bike, Plane, Lightbulb, Zap, Droplet, Wifi, Smartphone,
  House, Sofa, Wrench, Pill, Stethoscope, Heart, Clapperboard, Music, Gamepad2, Tv, Shirt, Scissors, Sparkles, Dumbbell,
  GraduationCap, BookOpen, Baby, PawPrint, Gift, HandHeart, Users, Tent, TreePalm, Briefcase, Landmark, PiggyBank, CreditCard,
  Tractor, Fence, Carrot, Warehouse, Sprout, Wheat, Hammer, Compass, Mountain, UserCheck, Apple, Banana, Citrus, Grape, Cherry, Megaphone, CalendarClock, HardHat, Shovel, Receipt, Tag, Shapes,
};

export const iconoPorNombre = (n) => ICONOS[n] || Tag;
export { CircleDashed };

/** Colores sugeridos, todos legibles sobre el fondo oscuro. */
export const COLORES = [
  '#8FB573', '#5FB8A5', '#6FA8C9', '#8E9DDB', '#B48CD9', '#D98CB3',
  '#DE7F72', '#E0A458', '#CDBB5E', '#B98668', '#9AA396', '#7FC4D6',
];
