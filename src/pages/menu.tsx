import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  CircularProgress, 
  Box, 
  Snackbar, 
  Alert, 
  Paper,
  IconButton,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  Fab,
  Slide,
  Zoom,
  Chip,
  Stack,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SendIcon from '@mui/icons-material/Send';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StarIcon from '@mui/icons-material/Star';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id?: number;
  categories?: {
    id: number;
    name: string;
    description?: string;
  };
};

type Category = {
  id: number;
  name: string;
  description?: string;
  display_order: number;
};

type Addon = {
  id: number;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
};

type SizeVariant = {
  id: number;
  menu_item_id: number;
  size_name: string;
  price_modifier: number;
  is_default: boolean;
  is_active: boolean;
};

type OrderItem = {
  menu_item_id: number;
  quantity: number;
  selected_addons: number[];
  selected_size_variant?: number;
  notes?: string;
};

type Table = {
  id: number;
  number: number;
  status: 'available' | 'occupied' | 'reserved';
};

export default function MenuPage() {
  const router = useRouter();
  const { table } = router.query;
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [sizeVariants, setSizeVariants] = useState<SizeVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<{ [key: number]: OrderItem }>({});
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning'}>({open: false, message: '', severity: 'info'});
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [itemDialog, setItemDialog] = useState<{open: boolean, item: MenuItem | null}>({open: false, item: null});
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  const [selectedSizeVariant, setSelectedSizeVariant] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const theme = useTheme();

  // Buscar dados do cardápio
  const fetchData = useCallback(async () => {
    try {
      console.log('Buscando dados do cardápio...');
      setLoading(true);
      
      // Buscar categorias
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
        
      if (categoriesError) {
        console.error('Erro ao buscar categorias:', categoriesError);
      } else {
        setCategories(categoriesData || []);
      }
      
      // Buscar adicionais
      const { data: addonsData, error: addonsError } = await supabase
        .from('addons')
        .select('*')
        .eq('is_active', true)
        .order('name');
        
      if (addonsError) {
        console.error('Erro ao buscar adicionais:', addonsError);
      } else {
        setAddons(addonsData || []);
      }
      
      // Buscar variações de tamanho
      const { data: sizeVariantsData, error: sizeVariantsError } = await supabase
        .from('size_variants')
        .select('*')
        .eq('is_active', true)
        .order('price_modifier');
        
      if (sizeVariantsError) {
        console.error('Erro ao buscar variações de tamanho:', sizeVariantsError);
      } else {
        setSizeVariants(sizeVariantsData || []);
      }
      
      // Buscar itens do menu
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select(`
          *,
          categories (
            id,
            name,
            description
          )
        `)
        .order('name');
        
      if (menuError) {
        console.error('Erro ao buscar menu:', menuError);
        setSnackbar({open: true, message: `Erro ao carregar cardápio: ${menuError.message}`, severity: 'error'});
        return;
      }
      
      if (menuData) {
        console.log(`${menuData.length} itens encontrados no cardápio`);
        setMenu(menuData);
      }
    } catch (e) {
      console.error('Exceção ao buscar dados:', e);
      setSnackbar({open: true, message: `Erro inesperado: ${e}`, severity: 'error'});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Abrir diálogo de item para configurar adicionais e variações
  const openItemDialog = (item: MenuItem) => {
    const itemSizeVariants = sizeVariants.filter(sv => sv.menu_item_id === item.id);
    const defaultVariant = itemSizeVariants.find(sv => sv.is_default);
    
    setSelectedAddons([]);
    setSelectedSizeVariant(defaultVariant?.id || (itemSizeVariants[0]?.id || null));
    setQuantity(1);
    setItemDialog({open: true, item});
  };

  // Fechar diálogo de item
  const closeItemDialog = () => {
    setItemDialog({open: false, item: null});
    setSelectedAddons([]);
    setSelectedSizeVariant(null);
    setQuantity(1);
  };

  // Adicionar item ao carrinho
  const handleAdd = (item: MenuItem | number) => {
    const menuItem = typeof item === 'number' ? menu.find(m => m.id === item) : item;
    if (!menuItem) return;

    const itemSizeVariants = sizeVariants.filter(sv => sv.menu_item_id === menuItem.id);
    const hasVariations = itemSizeVariants.length > 0;
    const hasAddons = addons.length > 0; // Mostrar todos os addons por enquanto

    if (hasVariations || hasAddons) {
      // Se tem variações ou adicionais, abrir diálogo
      openItemDialog(menuItem);
    } else {
      // Adicionar diretamente
      const orderItem: OrderItem = {
        menu_item_id: menuItem.id,
        quantity: 1,
        selected_addons: [],
        selected_size_variant: undefined
      };
      
      setOrder(prev => ({
        ...prev,
        [menuItem.id]: prev[menuItem.id] 
          ? { ...prev[menuItem.id], quantity: prev[menuItem.id].quantity + 1 }
          : orderItem
      }));
      
      setSnackbar({open: true, message: 'Item adicionado ao carrinho!', severity: 'success'});
    }
  };

  // Adicionar item configurado ao carrinho
  const addConfiguredItemToCart = () => {
    if (!itemDialog.item) return;

    const orderItem: OrderItem = {
      menu_item_id: itemDialog.item.id,
      quantity: quantity,
      selected_addons: selectedAddons,
      selected_size_variant: selectedSizeVariant || undefined
    };

    setOrder(prev => ({
      ...prev,
      [itemDialog.item!.id]: prev[itemDialog.item!.id]
        ? { 
            ...prev[itemDialog.item!.id], 
            quantity: prev[itemDialog.item!.id].quantity + quantity,
            selected_addons: [...new Set([...prev[itemDialog.item!.id].selected_addons, ...selectedAddons])],
            selected_size_variant: selectedSizeVariant || prev[itemDialog.item!.id].selected_size_variant
          }
        : orderItem
    }));

    closeItemDialog();
    setSnackbar({open: true, message: 'Item adicionado ao carrinho!', severity: 'success'});
  };
  
  // Remover item do pedido
  const handleRemove = (id: number) => {
    setOrder((prev) => {
      const next = { ...prev };
      if (next[id] && next[id].quantity > 0) {
        next[id] = { ...next[id], quantity: next[id].quantity - 1 };
        if (next[id].quantity === 0) delete next[id];
      }
      return next;
    });
  };
  
  // Fechar snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };
  
  // Calcular total de itens no carrinho
  const getTotalItems = () => {
    return Object.values(order).reduce((sum, orderItem) => sum + orderItem.quantity, 0);
  };
  
  // Calcular valor total do pedido
  const getTotalPrice = () => {
    return Object.entries(order).reduce((total, [itemId, orderItem]) => {
      const menuItem = menu.find(item => item.id === Number(itemId));
      if (!menuItem) return total;
      
      let itemPrice = menuItem.price;
      
      // Adicionar preço da variação de tamanho
      if (orderItem.selected_size_variant) {
        const sizeVariant = sizeVariants.find(sv => sv.id === orderItem.selected_size_variant);
        if (sizeVariant) {
          itemPrice += sizeVariant.price_modifier;
        }
      }
      
      // Adicionar preço dos adicionais
      const addonsPrice = orderItem.selected_addons.reduce((addonTotal, addonId) => {
        const addon = addons.find(a => a.id === addonId);
        return addonTotal + (addon ? addon.price : 0);
      }, 0);
      
      return total + ((itemPrice + addonsPrice) * orderItem.quantity);
    }, 0);
  };

  // Enviar pedido para a cozinha
  const handleSubmit = async () => {
    try {
      // Verificar se há itens no pedido
      if (getTotalItems() === 0) {
        setSnackbar({open: true, message: 'Adicione pelo menos um item ao pedido', severity: 'warning'});
        return;
      }
      
      // Verificar se a mesa foi identificada
      if (!table) {
        setSnackbar({open: true, message: 'Mesa não identificada!', severity: 'error'});
        return;
      }
      
      setSubmitting(true);
      console.log(`Enviando pedido para a mesa ${table}...`);
      
      // Buscar ID da mesa
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('id, number')
        .eq('number', table)
        .single() as { data: Table | null, error: any };
        
      if (tableError || !tableData) {
        console.error('Erro ao buscar mesa:', tableError);
        setSnackbar({open: true, message: 'Mesa inválida!', severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      // Filtrar apenas itens com quantidade > 0
      const items = Object.entries(order).filter(([_, orderItem]) => orderItem.quantity > 0);
      if (items.length === 0) {
        setSnackbar({open: true, message: 'Adicione pelo menos um item ao pedido', severity: 'warning'});
        setSubmitting(false);
        return;
      }
      
      // Calcular o preço total do pedido
      const totalPrice = getTotalPrice();
      console.log(`Total do pedido: R$ ${totalPrice.toFixed(2)}`);
      
      // Criar o pedido com o preço total
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: tableData.id,
          status: 'pending',
          total: totalPrice,
          created_at: new Date().toISOString() // Adicionar timestamp explícito
        })
        .select()
        .single();
        
      if (orderError) {
        console.error('Erro ao criar pedido:', orderError);
        setSnackbar({open: true, message: `Erro ao criar pedido: ${orderError.message}`, severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      if (!orderData) {
        console.error('Pedido criado, mas sem dados retornados');
        setSnackbar({open: true, message: 'Erro ao criar pedido: sem dados retornados', severity: 'error'});
        setSubmitting(false);
        return;
      }
      
      console.log(`Pedido ${orderData.id} criado com sucesso. Adicionando itens...`);
      
      // Adicionar os itens do pedido com adicionais e variações
      const orderItemPromises = items.map(async ([menu_item_id, orderItem]) => {
        const { data: itemData, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderData.id,
            menu_item_id: Number(menu_item_id),
            quantity: orderItem.quantity,
            notes: orderItem.notes || null
          })
          .select()
          .single();
          
        if (itemError) {
          console.error(`Erro ao adicionar item ${menu_item_id} ao pedido:`, itemError);
          return false;
        }
        
        // Adicionar os adicionais do item
        if (orderItem.selected_addons.length > 0) {
          const addonPromises = orderItem.selected_addons.map(async (addonId) => {
            const { error: addonError } = await supabase
              .from('order_item_addons')
              .insert({
                order_item_id: itemData.id,
                addon_id: addonId
              });
              
            if (addonError) {
              console.error(`Erro ao adicionar addon ${addonId} ao item ${menu_item_id}:`, addonError);
              return false;
            }
            return true;
          });
          
          const addonResults = await Promise.all(addonPromises);
          if (addonResults.some(result => !result)) {
            console.error(`Alguns adicionais do item ${menu_item_id} não puderam ser salvos`);
          }
        }
        
        return true;
      });
      
      // Aguardar todas as inserções de itens
      const results = await Promise.all(orderItemPromises);
      
      // Atualizar o status da mesa para 'occupied'
      const { error: tableUpdateError } = await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tableData.id);
        
      if (tableUpdateError) {
        console.error('Erro ao atualizar status da mesa:', tableUpdateError);
        // Não interromper o fluxo, apenas registrar o erro
      } else {
        console.log(`Mesa ${table} marcada como ocupada`);
      }
      
      if (results.some(result => !result)) {
        setSnackbar({open: true, message: 'Alguns itens não puderam ser adicionados ao pedido', severity: 'warning'});
      } else {
        console.log('Todos os itens adicionados com sucesso');
        setSnackbar({open: true, message: 'Pedido enviado para a cozinha!', severity: 'success'});
        setOrder({}); // Limpar o carrinho
      }
    } catch (e) {
      console.error('Exceção ao enviar pedido:', e);
      setSnackbar({open: true, message: `Erro inesperado: ${e}`, severity: 'error'});
    } finally {
      setSubmitting(false);
    }
  };

  // Renderização durante carregamento
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      pb: 10
    }}>
      {/* Header Fixo com Glassmorphism */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0,
          right: 0,
          zIndex: 1000, 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 0
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                <RestaurantIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
                  Mesa {table}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cardápio Digital
                </Typography>
              </Box>
            </Box>
            
            <motion.div whileTap={{ scale: 0.95 }}>
              <Badge 
                badgeContent={getTotalItems()} 
                color="primary" 
                showZero={false}
                sx={{ 
                  '& .MuiBadge-badge': { 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    animation: getTotalItems() > 0 ? 'pulse 2s infinite' : 'none'
                  } 
                }}
              >
                <IconButton 
                  sx={{ 
                    bgcolor: getTotalItems() > 0 ? 'primary.main' : 'transparent',
                    color: getTotalItems() > 0 ? 'white' : 'primary.main',
                    '&:hover': { bgcolor: 'primary.light' },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <ShoppingCartIcon />
                </IconButton>
              </Badge>
            </motion.div>
          </Box>
        </Container>
      </Paper>

      {/* Conteúdo Principal */}
      <Container maxWidth="sm" sx={{ pt: 10, px: 2 }}>
        {/* Seção de Boas-vindas */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800, 
                color: 'white', 
                mb: 1,
                textShadow: '0 2px 10px rgba(0,0,0,0.3)'
              }}
            >
              Bem-vindo!
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                mb: 2,
                textShadow: '0 1px 5px rgba(0,0,0,0.3)'
              }}
            >
              Escolha seus pratos favoritos e faça seu pedido
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Chip 
                icon={<StarIcon />} 
                label="Qualidade Premium" 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }} 
              />
              <Chip 
                icon={<LocalOfferIcon />} 
                label="Entrega Rápida" 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }} 
              />
            </Stack>
          </Box>
        </motion.div>

        {/* Grid de Itens do Menu */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',     // 1 coluna no mobile portrait
            sm: 'repeat(2, 1fr)',     // 2 colunas no mobile landscape/tablet
            md: 'repeat(3, 1fr)',     // 3 colunas no tablet grande
            lg: 'repeat(4, 1fr)',     // 4 colunas no desktop
            xl: 'repeat(4, 1fr)'      // 4 colunas no desktop grande
          },
          gap: { xs: 1.5, sm: 2, md: 2.5 },
          mb: 3,
          maxWidth: '100%',
          mx: 'auto'
        }}>
          <AnimatePresence>
            {menu.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.05,
                  type: "spring",
                  stiffness: 120
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  elevation={6}
                  sx={{ 
                    height: '100%',
                    borderRadius: 3,
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
                    }
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    {/* Imagem do Prato */}
                    {item.image_url ? (
                      <Box 
                        sx={{ 
                          height: { xs: 140, sm: 120, md: 140 }, 
                          backgroundImage: `url(${item.image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '40%',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.3))'
                          }
                        }} 
                      >
                        {/* Badge de quantidade se houver no carrinho */}
                        {order[item.id] && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <Chip
                              label={order[item.id]}
                              color="primary"
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                height: 24,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}
                            />
                          </motion.div>
                        )}
                      </Box>
                    ) : (
                      <Box 
                        sx={{ 
                          height: { xs: 140, sm: 120, md: 140 }, 
                          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        <RestaurantIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          Sem imagem
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 700, 
                        mb: 0.5,
                        color: 'text.primary',
                        lineHeight: 1.2,
                        fontSize: { xs: '0.95rem', sm: '1rem' }
                      }}
                    >
                      {item.name}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 1.5, 
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontSize: '0.85rem',
                        flexGrow: 1
                      }}
                    >
                      {item.description}
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      mt: 'auto'
                    }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 800, 
                          color: 'primary.main',
                          fontSize: { xs: '1.1rem', sm: '1.25rem' }
                        }}
                      >
                        R$ {item.price.toFixed(2)}
                      </Typography>
                      
                      {/* Controles de Quantidade Compactos */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5,
                        bgcolor: 'grey.100',
                        borderRadius: 2,
                        p: 0.3
                      }}>
                        <motion.div whileTap={{ scale: 0.9 }}>
                          <IconButton 
                            onClick={() => handleRemove(item.id)} 
                            disabled={!order[item.id]}
                            size="small"
                            sx={{
                              bgcolor: order[item.id] ? 'error.main' : 'grey.300',
                              color: order[item.id] ? 'white' : 'grey.500',
                              '&:hover': { 
                                bgcolor: order[item.id] ? 'error.dark' : 'grey.400' 
                              },
                              '&:disabled': {
                                bgcolor: 'grey.200',
                                color: 'grey.400'
                              },
                              width: 28,
                              height: 28,
                              minWidth: 28
                            }}
                          >
                            <RemoveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </motion.div>
                        
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 'bold',
                            minWidth: '24px',
                            textAlign: 'center',
                            color: 'text.primary',
                            fontSize: '0.9rem'
                          }}
                        >
                          {order[item.id] || 0}
                        </Typography>
                        
                        <motion.div whileTap={{ scale: 0.9 }}>
                          <IconButton 
                            onClick={() => handleAdd(item.id)} 
                            size="small"
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'white',
                              '&:hover': { bgcolor: 'primary.dark' },
                              width: 28,
                              height: 28,
                              minWidth: 28
                            }}
                          >
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </motion.div>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>

        {/* Espaço para o botão flutuante */}
        <Box sx={{ height: 100 }} />
      </Container>

      {/* Botão Flutuante do Carrinho */}
      <AnimatePresence>
        {getTotalItems() > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Paper 
              elevation={12}
              sx={{ 
                position: 'fixed', 
                bottom: 20, 
                left: 20,
                right: 20,
                zIndex: 1000,
                borderRadius: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ p: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 1
                }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                      {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Total: R$ {getTotalPrice().toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button 
                      variant="contained" 
                      size="large"
                      disabled={submitting || getTotalItems() === 0}
                      onClick={handleSubmit}
                      startIcon={<SendIcon />}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 3,
                        px: 3,
                        py: 1,
                        fontWeight: 700,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.3)',
                        },
                        '&:disabled': {
                          bgcolor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.5)'
                        }
                      }}
                    >
                      {submitting ? 'Enviando...' : 'Enviar Pedido'}
                    </Button>
                  </motion.div>
                </Box>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Snackbar para feedback */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ 
            width: '100%',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Animação CSS personalizada */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Custom scrollbar para webkit browsers */
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.3);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.5);
        }
      `}</style>
    </Box>
  );
}
