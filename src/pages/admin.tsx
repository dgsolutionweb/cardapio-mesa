import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, IconButton, Button, Box, Grid, Card, CardContent, CardActions, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, useTheme, useMediaQuery, CircularProgress, Avatar, Paper, FormControl, InputLabel, Select, MenuItem, Chip, Checkbox, FormControlLabel, Switch
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import TableBarIcon from '@mui/icons-material/TableBar';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import QrCodeIcon from '@mui/icons-material/QrCode';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import StarIcon from '@mui/icons-material/Star';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PaymentIcon from '@mui/icons-material/Payment';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import '@fontsource/inter/400.css';
import '@fontsource/roboto-flex/400.css';

// Importar QRCodeSVG dinamicamente para evitar erro de window is not defined
const QRCodeSVG = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), {
  ssr: false, // Desativar renderização do lado do servidor
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const drawerWidth = 280;

// Estilos globais para animações
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes pulse {
      0% {
        opacity: 0.6;
        transform: scale(1);
      }
      50% {
        opacity: 1;
        transform: scale(1.05);
      }
      100% {
        opacity: 0.6;
        transform: scale(1);
      }
    }
  `}</style>
);

export default function AdminPage() {
  // Mesas
  const [tables, setTables] = useState<{id:number,number:number,status:string}[]>([]);
  const [newTable, setNewTable] = useState('');
  // Cardápio
  const [menu, setMenu] = useState<any[]>([]);
  const [menuDialog, setMenuDialog] = useState(false);
  const [editingMenu, setEditingMenu] = useState<any|null>(null);
  const [menuForm, setMenuForm] = useState({ name:'', description:'', price:'', image_url:'', category_id:'' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Categorias
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any|null>(null);
  const [categoryForm, setCategoryForm] = useState({ name:'', description:'', display_order:'' });
  
  // Adicionais
  const [addons, setAddons] = useState<any[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  const [addonDialog, setAddonDialog] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any|null>(null);
  const [addonForm, setAddonForm] = useState({ name:'', description:'', price:'' });
  
  // Variações de tamanho
  const [sizeVariants, setSizeVariants] = useState<any[]>([]);
  const [newSizeVariant, setNewSizeVariant] = useState({ size_name: '', price_modifier: '', is_default: false });
  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  // QR Code
  const [qrTable, setQrTable] = useState<number|null>(null);
  // Pedidos
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any|null>(null);
  const [tableStatusDialog, setTableStatusDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any|null>(null);
  const [reservationName, setReservationName] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  // Feedback visual
  const [snackbar, setSnackbar] = useState<{open:boolean,message:string,severity:'success'|'error'|'info'}>({open:false,message:'',severity:'success'});
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [printingOrder, setPrintingOrder] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const printComponentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTables();
    fetchMenu();
    fetchOrders();
    fetchCategories();
    fetchAddons();
  }, []);

  // Controlar drawer baseado no tamanho da tela
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
    } else {
      setDrawerOpen(true);
    }
  }, [isMobile]);
  async function fetchTables() {
    setLoading(true);
    const { data } = await supabase.from('tables').select('*').order('number');
    if (data) setTables(data);
    setLoading(false);
  }
  
  async function fetchOrders() {
    setLoadingOrders(true);
    try {
      // Buscar todos os pedidos
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (ordersError) {
        console.error('Erro ao buscar pedidos:', ordersError);
        setSnackbar({open: true, message: `Erro ao buscar pedidos: ${ordersError.message}`, severity: 'error'});
        return;
      }
      
      // Buscar todos os itens de pedidos
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*, menu_items(*)');
        
      if (itemsError) {
        console.error('Erro ao buscar itens de pedidos:', itemsError);
        setSnackbar({open: true, message: `Erro ao buscar itens de pedidos: ${itemsError.message}`, severity: 'error'});
        return;
      }

      // Buscar adicionais dos itens se houver itens
      let orderItemAddonMap: Record<number, { id: number, name: string, price: number }[]> = {};
      if (itemsData && itemsData.length > 0) {
        const orderItemIds = itemsData.map(item => item.id);
        
        const { data: orderItemAddons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('order_item_id, addon_id, addon_name, addon_price')
          .in('order_item_id', orderItemIds);
          
        if (addonsError) {
          console.error('Erro ao buscar adicionais dos itens:', addonsError);
        } else if (orderItemAddons && orderItemAddons.length > 0) {
          console.log('Adicionais de itens encontrados no admin:', orderItemAddons.length);
          // Criar mapa de item_id -> [addons]
          for (const oia of orderItemAddons) {
            if (!orderItemAddonMap[oia.order_item_id]) {
              orderItemAddonMap[oia.order_item_id] = [];
            }
            orderItemAddonMap[oia.order_item_id].push({
              id: oia.addon_id,
              name: oia.addon_name,
              price: oia.addon_price
            });
          }
        }
      }

      // Buscar variações de tamanho
      const { data: sizeVariants, error: sizeVariantsError } = await supabase
        .from('size_variants')
        .select('*');
        
      if (sizeVariantsError) {
        console.error('Erro ao buscar variações de tamanho:', sizeVariantsError);
      }

      // Processar itens adicionando adicionais e variações
      const processedItems = (itemsData || []).map(item => ({
        ...item,
        addons: orderItemAddonMap[item.id] || [],
        size_variant: item.size_variant_id ? 
          sizeVariants?.find(sv => sv.id === item.size_variant_id) : null
      }));
      
      // Verificar se há pedidos ativos
      const activeOrders = ordersData?.filter(order => order.status !== 'completed') || [];
      console.log(`Total de pedidos: ${ordersData?.length || 0}, Pedidos ativos: ${activeOrders.length}`);
      if (activeOrders.length === 0) {
        console.log('Nenhum pedido ativo encontrado');
      } else {
        console.log('Pedidos ativos:', activeOrders);
      }
      
      setOrders(ordersData || []);
      setOrderItems(processedItems);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      setSnackbar({open: true, message: `Erro inesperado: ${error}`, severity: 'error'});
    } finally {
      setLoadingOrders(false);
    }
  }
  async function fetchMenu() {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('id');
    
    if (error) {
      console.error('Erro ao buscar menu:', error);
      setSnackbar({open: true, message: `Erro ao buscar menu: ${error.message}`, severity: 'error'});
    }
    
    if (data) setMenu(data);
    setLoading(false);
  }
  
  // Funções para categorias
  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    if (data) setCategories(data);
  }

  function openCategoryDialog(category?: any) {
    setEditingCategory(category || null);
    setCategoryForm(category ? { 
      name: category.name, 
      description: category.description || '', 
      display_order: String(category.display_order || '') 
    } : { name:'', description:'', display_order:'' });
    setCategoryDialog(true);
  }

  function closeCategoryDialog() { 
    setCategoryDialog(false); 
    setEditingCategory(null); 
  }

  async function saveCategory() {
    if (editingCategory) {
      await supabase.from('categories').update({ 
        ...categoryForm, 
        display_order: Number(categoryForm.display_order) || 0 
      }).eq('id', editingCategory.id);
      setSnackbar({open:true,message:'Categoria atualizada!',severity:'success'});
    } else {
      await supabase.from('categories').insert({ 
        ...categoryForm, 
        display_order: Number(categoryForm.display_order) || 0 
      });
      setSnackbar({open:true,message:'Categoria adicionada!',severity:'success'});
    }
    closeCategoryDialog();
    fetchCategories();
  }

  async function removeCategory(id: number) {
    await supabase.from('categories').delete().eq('id', id);
    fetchCategories();
    setSnackbar({open:true,message:'Categoria removida!',severity:'info'});
  }

  // Funções para adicionais
  async function fetchAddons() {
    const { data } = await supabase.from('addons').select('*').order('name');
    if (data) setAddons(data);
  }

  function openAddonDialog(addon?: any) {
    setEditingAddon(addon || null);
    setAddonForm(addon ? { 
      name: addon.name, 
      description: addon.description || '', 
      price: String(addon.price) 
    } : { name:'', description:'', price:'' });
    setAddonDialog(true);
  }

  function closeAddonDialog() { 
    setAddonDialog(false); 
    setEditingAddon(null); 
  }

  async function saveAddon() {
    if (editingAddon) {
      await supabase.from('addons').update({ 
        ...addonForm, 
        price: Number(addonForm.price) || 0 
      }).eq('id', editingAddon.id);
      setSnackbar({open:true,message:'Adicional atualizado!',severity:'success'});
    } else {
      await supabase.from('addons').insert({ 
        ...addonForm, 
        price: Number(addonForm.price) || 0 
      });
      setSnackbar({open:true,message:'Adicional adicionado!',severity:'success'});
    }
    closeAddonDialog();
    fetchAddons();
  }

  async function removeAddon(id: number) {
    await supabase.from('addons').delete().eq('id', id);
    fetchAddons();
    setSnackbar({open:true,message:'Adicional removido!',severity:'info'});
  }

  async function fetchSizeVariants(menuItemId: number) {
    const { data } = await supabase
      .from('size_variants')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });
    if (data) setSizeVariants(data);
  }
  
  async function fetchMenuItemAddons(menuItemId: number) {
    const { data } = await supabase
      .from('menu_item_addons')
      .select('addon_id')
      .eq('menu_item_id', menuItemId);
    if (data) setSelectedAddons(data.map(item => item.addon_id));
  }
  async function addTable() {
    if (!newTable) return;
    await supabase.from('tables').insert({ 
      number: Number(newTable),
      status: 'available'
    });
    setNewTable('');
    fetchTables();
    setSnackbar({open:true,message:'Mesa adicionada!',severity:'success'});
  }
  async function removeTable(id:number) {
    await supabase.from('tables').delete().eq('id', id);
    fetchTables();
    setSnackbar({open:true,message:'Mesa removida!',severity:'info'});
  }
  function openQr(table:number) { setQrTable(table); }
  function closeQr() { setQrTable(null); }
  
  // Gerenciamento de status das mesas
  function openTableStatusDialog(table: any) {
    setSelectedTable(table);
    setReservationName('');
    setTableStatusDialog(true);
  }
  
  function closeTableStatusDialog() {
    setTableStatusDialog(false);
    setSelectedTable(null);
  }
  
  async function updateTableStatus(status: string) {
    if (!selectedTable) return;
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ 
          status: status,
          // Se for uma reserva, poderia adicionar o nome da pessoa que reservou
          // reservation_name: status === 'reserved' ? reservationName : null
        })
        .eq('id', selectedTable.id);
      
      if (error) {
        console.error('Erro ao atualizar status da mesa:', error);
        setSnackbar({open: true, message: `Erro ao atualizar mesa: ${error.message}`, severity: 'error'});
        return;
      }
      
      setSnackbar({
        open: true, 
        message: `Mesa ${selectedTable.number} ${status === 'available' ? 'disponível' : status === 'occupied' ? 'marcada como ocupada' : 'reservada'}!`, 
        severity: 'success'
      });
      
      closeTableStatusDialog();
      fetchTables();
    } catch (error) {
      console.error('Erro ao atualizar status da mesa:', error);
      setSnackbar({open: true, message: `Erro inesperado: ${error}`, severity: 'error'});
    }
  }
  
  // Gerenciamento de pedidos
  function viewOrderDetails(order: any) {
    setSelectedOrder(order);
  }
  
  function closeOrderDetails() {
    setSelectedOrder(null);
  }
  
  // Função para abrir o diálogo de pagamento
  // Agora aceita múltiplos pedidos de uma mesa
  function openPaymentDialog(order: any, allTableOrders?: any[]) {
    // Se allTableOrders for fornecido, usamos todos os pedidos da mesa
    // Caso contrário, buscamos todos os pedidos ativos da mesma mesa
    if (allTableOrders) {
      // Usar os pedidos fornecidos
      setSelectedOrder({
        ...order,
        allTableOrders: allTableOrders
      });
    } else {
      // Buscar todos os pedidos ativos da mesma mesa
      const tableOrders = orders.filter(o => 
        o.table_id === order.table_id && 
        o.status !== 'completed'
      );
      
      setSelectedOrder({
        ...order,
        allTableOrders: tableOrders
      });
    }
    
    setPaymentDialog(true);
  }
  
  function closePaymentDialog() {
    setPaymentDialog(false);
  }
  
  // Função para imprimir a comanda
  const handlePrint = useReactToPrint({
    documentTitle: 'Comanda',
    contentRef: printComponentRef,
    onAfterPrint: () => {
      console.log('Impressão concluída com sucesso');
      setPrintingOrder(false);
      // Após a impressão, completar o pedido
      finishOrder();
      setSnackbar({open: true, message: 'Comanda impressa com sucesso!', severity: 'success'});
    },
    onPrintError: (errorLocation, error) => {
      console.error(`Erro ao imprimir (${errorLocation}):`, error);
      setPrintingOrder(false);
      setSnackbar({open: true, message: `Erro ao imprimir: ${error.message}`, severity: 'error'});
    },
    // Adiciona estilo personalizado para a página de impressão
    pageStyle: `
      @media print {
        @page { size: 80mm auto; margin: 0mm; }
        body { margin: 10mm 5mm; }
      }
    `
  });

  async function completeOrder() {
    // Iniciar o processo de impressão
    handlePrint();
  }

  async function finishOrder() {
    if (!selectedOrder) return;
    
    try {
      // Verificar se temos múltiplos pedidos para processar
      const ordersToProcess = selectedOrder.allTableOrders || [selectedOrder];
      console.log(`Finalizando ${ordersToProcess.length} pedido(s) da mesa ${selectedOrder.table_id}`);
      
      // Atualizar o status de todos os pedidos para 'completed'
      for (const order of ordersToProcess) {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', order.id);
        
        if (orderError) {
          console.error(`Erro ao completar pedido ${order.id}:`, orderError);
          setSnackbar({open: true, message: `Erro ao completar pedido: ${orderError.message}`, severity: 'error'});
          return;
        }
      }
      
      // Verificar se há outros pedidos ativos para esta mesa
      const { data: activeOrders, error: checkError } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', selectedOrder.table_id)
        .neq('status', 'completed');
      
      // Se não houver mais pedidos ativos, marcar a mesa como disponível
      if (!activeOrders || activeOrders.length === 0) {
        const { error: tableError } = await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', selectedOrder.table_id);
          
        if (tableError) {
          console.error('Erro ao atualizar status da mesa:', tableError);
        }
      }
      
      setSnackbar({open: true, message: 'Conta fechada com sucesso!', severity: 'success'});
      closePaymentDialog();
      closeOrderDetails();
      fetchOrders();
      fetchTables();
    } catch (error) {
      console.error('Erro ao finalizar pedidos:', error);
      setSnackbar({open: true, message: `Erro inesperado: ${error}`, severity: 'error'});
    }
  }
  
  // Função para criar um pedido de teste para depuração
  async function createTestOrder() {
    try {
      setLoading(true);
      
      // Verificar se há mesas disponíveis
      if (tables.length === 0) {
        setSnackbar({open: true, message: 'Nenhuma mesa disponível para criar pedido teste', severity: 'error'});
        return;
      }
      
      // Pegar a primeira mesa disponível ou qualquer mesa se não houver disponíveis
      const availableTable = tables.find(t => t.status === 'available') || tables[0];
      
      // Criar o pedido de teste
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: availableTable.id,
          status: 'pending', // Status inicial do pedido
          total: 50.00, // Valor de teste
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (orderError) {
        console.error('Erro ao criar pedido de teste:', orderError);
        setSnackbar({open: true, message: `Erro ao criar pedido de teste: ${orderError.message}`, severity: 'error'});
        return;
      }
      
      if (!orderData) {
        setSnackbar({open: true, message: 'Erro ao criar pedido: sem dados retornados', severity: 'error'});
        return;
      }
      
      // Adicionar um item de teste ao pedido
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: orderData.id,
          menu_item_id: 1, // Assumindo que existe pelo menos um item de menu com ID 1
          quantity: 2
        });
      
      if (itemError) {
        console.error('Erro ao adicionar item ao pedido de teste:', itemError);
        // Não interromper o fluxo, apenas registrar o erro
      }
      
      // Atualizar o status da mesa para ocupada
      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', availableTable.id);
      
      if (tableError) {
        console.error('Erro ao atualizar status da mesa:', tableError);
        // Não interromper o fluxo, apenas registrar o erro
      }
      
      setSnackbar({open: true, message: `Pedido de teste #${orderData.id} criado com sucesso!`, severity: 'success'});
      
      // Atualizar os dados
      fetchOrders();
      fetchTables();
    } catch (error) {
      console.error('Erro ao criar pedido de teste:', error);
      setSnackbar({open: true, message: `Erro inesperado: ${error}`, severity: 'error'});
    } finally {
      setLoading(false);
    }
  }

  // CRUD Cardápio
  function openMenuDialog(item?:any) {
    setEditingMenu(item||null);
    setMenuForm(item ? { 
      ...item, 
      price: String(item.price),
      category_id: String(item.category_id || '') 
    } : { 
      name:'', 
      description:'', 
      price:'', 
      image_url:'', 
      category_id:'' 
    });
    
    // Limpar dados de adicionais e variações
    setSelectedAddons([]);
    setSizeVariants([]);
    setNewSizeVariant({ size_name: '', price_modifier: '', is_default: false });
    
    // Se estiver editando, buscar adicionais e variações existentes
    if (item) {
      fetchMenuItemAddons(item.id);
      fetchSizeVariants(item.id);
    }
    
    setMenuDialog(true);
  }
  function closeMenuDialog() { 
    setMenuDialog(false); 
    setEditingMenu(null); 
    setSelectedImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
  async function saveMenu() {
    try {
      console.log('MenuForm data:', menuForm);
      
      // Fazer upload da imagem se uma foi selecionada
      let imageUrl = menuForm.image_url;
      if (selectedImageFile) {
        const uploadedImageUrl = await uploadImage();
        if (uploadedImageUrl) {
          // Se havia uma imagem anterior e não é a mesma, deletar a anterior
          if (editingMenu && editingMenu.image_url && editingMenu.image_url !== uploadedImageUrl) {
            await deleteImage(editingMenu.image_url);
          }
          imageUrl = uploadedImageUrl;
        } else {
          // Se falhou o upload, não continuar
          return;
        }
      }
      
      let menuItemId;
      
      if (editingMenu) {
        // Atualizar item existente
        const updateData = { 
          name: menuForm.name,
          description: menuForm.description,
          price: Number(menuForm.price),
          image_url: imageUrl,
          category_id: menuForm.category_id ? Number(menuForm.category_id) : null
        };
        
        console.log('Update data:', updateData);
        
        const { data, error } = await supabase
          .from('menu_items')
          .update(updateData)
          .eq('id', editingMenu.id)
          .select();
        
        if (error) throw error;
        menuItemId = editingMenu.id;
        setSnackbar({open:true,message:'Item atualizado!',severity:'success'});
      } else {
        // Criar novo item
        const insertData = { 
          name: menuForm.name,
          description: menuForm.description,
          price: Number(menuForm.price),
          image_url: imageUrl,
          category_id: menuForm.category_id ? Number(menuForm.category_id) : null
        };
        
        console.log('Insert data:', insertData);
        
        const { data, error } = await supabase
          .from('menu_items')
          .insert(insertData)
          .select();
        
        if (error) throw error;
        menuItemId = data[0].id;
        setSnackbar({open:true,message:'Item adicionado!',severity:'success'});
      }
      
      // Atualizar adicionais
      if (editingMenu) {
        // Remover associações existentes
        await supabase
          .from('menu_item_addons')
          .delete()
          .eq('menu_item_id', menuItemId);
      }
      
      // Adicionar novas associações de adicionais
      if (selectedAddons.length > 0) {
        const addonInserts = selectedAddons.map(addonId => ({
          menu_item_id: menuItemId,
          addon_id: addonId
        }));
        
        await supabase
          .from('menu_item_addons')
          .insert(addonInserts);
      }
      
      // Atualizar variações de tamanho
      if (editingMenu) {
        // Remover variações existentes
        await supabase
          .from('size_variants')
          .delete()
          .eq('menu_item_id', menuItemId);
      }
      
      // Adicionar novas variações de tamanho
      if (sizeVariants.length > 0) {
        const variantInserts = sizeVariants.map(variant => ({
          menu_item_id: menuItemId,
          size_name: variant.size_name,
          price_modifier: Number(variant.price_modifier),
          is_default: variant.is_default
        }));
        
        await supabase
          .from('size_variants')
          .insert(variantInserts);
      }
      
      closeMenuDialog();
      fetchMenu();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      setSnackbar({open:true,message:`Erro ao salvar: ${error.message}`,severity:'error'});
    }
  }

  // Funções para upload de imagem
  const handleImageFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setSnackbar({open: true, message: 'Tipo de arquivo não suportado. Use JPEG, PNG, WEBP ou GIF.', severity: 'error'});
        return;
      }
      
      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({open: true, message: 'Arquivo muito grande. Máximo 5MB.', severity: 'error'});
        return;
      }
      
      setSelectedImageFile(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedImageFile) return null;
    
    setUploadingImage(true);
    try {
      // Gerar nome único para o arquivo
      const fileExt = selectedImageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      
      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, selectedImageFile);
      
      if (error) {
        console.error('Erro no upload:', error);
        throw error;
      }
      
      // Obter URL pública da imagem
      const { data: publicData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);
      
      setSelectedImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      return publicData.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      setSnackbar({open: true, message: `Erro ao fazer upload da imagem: ${error.message}`, severity: 'error'});
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async (imageUrl: string) => {
    try {
      // Extrair o nome do arquivo da URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      const { error } = await supabase.storage
        .from('menu-images')
        .remove([fileName]);
      
      if (error) {
        console.error('Erro ao deletar imagem:', error);
      }
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
    }
  };

  async function removeMenu(id:number) {
    // Buscar o item para pegar a URL da imagem
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('image_url')
      .eq('id', id)
      .single();
    
    // Deletar o item do banco
    await supabase.from('menu_items').delete().eq('id', id);
    
    // Deletar a imagem associada se existir
    if (menuItem?.image_url) {
      await deleteImage(menuItem.image_url);
    }
    
    fetchMenu();
    setSnackbar({open:true,message:'Item removido!',severity:'info'});
  }

  // Funções para gerenciar variações de tamanho
  function addSizeVariant() {
    if (!newSizeVariant.size_name || !newSizeVariant.price_modifier) return;
    
    setSizeVariants(prev => [...prev, {
      ...newSizeVariant,
      price_modifier: Number(newSizeVariant.price_modifier),
      id: Date.now() // ID temporário para controle local
    }]);
    
    setNewSizeVariant({ size_name: '', price_modifier: '', is_default: false });
  }
  
  function removeSizeVariant(index: number) {
    setSizeVariants(prev => prev.filter((_, i) => i !== index));
  }
  
  function toggleAddon(addonId: number) {
    setSelectedAddons(prev => 
      prev.includes(addonId) 
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  }

  // Navegação Drawer
  const [currentPage, setCurrentPage] = useState<'tables' | 'menu' | 'orders' | 'settings'>('tables');
  
  const handlePageChange = (page: 'tables' | 'menu' | 'orders' | 'settings') => {
    setCurrentPage(page);
    // Fechar drawer automaticamente no mobile após navegar
    if (isMobile) {
      setDrawerOpen(false);
    }
  };
  const drawer = (
    <Box sx={{ 
      width: drawerWidth, 
      height: '100%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Inter, Roboto Flex, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '4px 0 20px rgba(0,0,0,0.15)'
    }}>
      {/* Background decorativo com mais elementos */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 120,
        height: 120,
        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        transform: 'translate(40px, -40px)',
        animation: 'pulse 3s infinite'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 100,
        height: 100,
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        transform: 'translate(-30px, 30px)',
        animation: 'pulse 4s infinite reverse'
      }} />
      <Box sx={{
        position: 'absolute',
        top: '50%',
        right: 0,
        width: 60,
        height: 60,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '50%',
        transform: 'translate(20px, -50%)',
        animation: 'pulse 2.5s infinite'
      }} />
      
      <motion.div 
        initial={{ scale: 0.7, opacity: 0, y: -20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, pb: 3, px: 3 }}>
          <Box sx={{ 
            position: 'relative',
            mb: 2
          }}>
            <Avatar sx={{ 
              bgcolor: 'rgba(255,255,255,0.25)', 
              width: 80, 
              height: 80, 
              mb: 1, 
              backdropFilter: 'blur(15px)',
              border: '3px solid rgba(255,255,255,0.4)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.1) rotate(5deg)',
                boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
              }
            }}>
              <EmojiFoodBeverageIcon sx={{ fontSize: 48, color: 'white' }} />
            </Avatar>
            {/* Glow effect mais refinado */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
              animation: 'pulse 2.5s infinite',
              zIndex: -1
            }} />
          </Box>
          <Typography variant="h5" sx={{ 
            fontWeight: 900, 
            color: 'white', 
            letterSpacing: 1.2,
            textAlign: 'center',
            textShadow: '0 3px 6px rgba(0,0,0,0.4)',
            background: 'linear-gradient(45deg, #fff 30%, rgba(255,255,255,0.8) 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Painel Admin
          </Typography>
          <Typography variant="body2" sx={{ 
            color: 'rgba(255,255,255,0.85)', 
            textAlign: 'center',
            mt: 0.5,
            fontWeight: 500,
            letterSpacing: 0.5
          }}>
            Cardápio Digital Pro
          </Typography>
        </Box>
      </motion.div>
      
      <Box sx={{ px: 3, pb: 3 }}>
        <List sx={{ '& .MuiListItem-root': { mb: 1.5 } }}>
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentPage === 'tables'} 
                onClick={() => handlePageChange('tables')} 
                sx={{
                  borderRadius: 4,
                  py: 2,
                  px: 3,
                  background: currentPage === 'tables' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  backdropFilter: currentPage === 'tables' ? 'blur(15px)' : 'none',
                  border: currentPage === 'tables' ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': { 
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(15px)',
                    transform: 'translateX(8px) scale(1.02)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  '&.Mui-selected': { 
                    background: 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.35)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '4px',
                      height: '100%',
                      background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.8))',
                      borderRadius: '0 2px 2px 0'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <TableBarIcon sx={{ 
                    color: 'white', 
                    fontSize: 28,
                    filter: currentPage === 'tables' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Mesas" 
                  primaryTypographyProps={{
                    fontWeight: currentPage === 'tables' ? 700 : 600,
                    color: 'white',
                    fontSize: '1rem',
                    letterSpacing: 0.5,
                    sx: {
                      textShadow: currentPage === 'tables' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </motion.div>
          
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentPage === 'menu'} 
                onClick={() => handlePageChange('menu')} 
                sx={{
                  borderRadius: 4,
                  py: 2,
                  px: 3,
                  background: currentPage === 'menu' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  backdropFilter: currentPage === 'menu' ? 'blur(15px)' : 'none',
                  border: currentPage === 'menu' ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': { 
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(15px)',
                    transform: 'translateX(8px) scale(1.02)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  '&.Mui-selected': { 
                    background: 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.35)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '4px',
                      height: '100%',
                      background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.8))',
                      borderRadius: '0 2px 2px 0'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <RestaurantMenuIcon sx={{ 
                    color: 'white', 
                    fontSize: 28,
                    filter: currentPage === 'menu' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Cardápio" 
                  primaryTypographyProps={{
                    fontWeight: currentPage === 'menu' ? 700 : 600,
                    color: 'white',
                    fontSize: '1rem',
                    letterSpacing: 0.5,
                    sx: {
                      textShadow: currentPage === 'menu' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </motion.div>
          
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentPage === 'orders'} 
                onClick={() => handlePageChange('orders')} 
                sx={{
                  borderRadius: 4,
                  py: 2,
                  px: 3,
                  background: currentPage === 'orders' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  backdropFilter: currentPage === 'orders' ? 'blur(15px)' : 'none',
                  border: currentPage === 'orders' ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': { 
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(15px)',
                    transform: 'translateX(8px) scale(1.02)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  '&.Mui-selected': { 
                    background: 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.35)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '4px',
                      height: '100%',
                      background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.8))',
                      borderRadius: '0 2px 2px 0'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <ReceiptIcon sx={{ 
                    color: 'white', 
                    fontSize: 28,
                    filter: currentPage === 'orders' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Pedidos" 
                  primaryTypographyProps={{
                    fontWeight: currentPage === 'orders' ? 700 : 600,
                    color: 'white',
                    fontSize: '1rem',
                    letterSpacing: 0.5,
                    sx: {
                      textShadow: currentPage === 'orders' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </motion.div>
          
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <ListItem disablePadding>
              <ListItemButton 
                selected={currentPage === 'settings'} 
                onClick={() => handlePageChange('settings')} 
                sx={{
                  borderRadius: 4,
                  py: 2,
                  px: 3,
                  background: currentPage === 'settings' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  backdropFilter: currentPage === 'settings' ? 'blur(15px)' : 'none',
                  border: currentPage === 'settings' ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': { 
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(15px)',
                    transform: 'translateX(8px) scale(1.02)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  '&.Mui-selected': { 
                    background: 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.35)'
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '4px',
                      height: '100%',
                      background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.8))',
                      borderRadius: '0 2px 2px 0'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 48 }}>
                  <SettingsIcon sx={{ 
                    color: 'white', 
                    fontSize: 28,
                    filter: currentPage === 'settings' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Configurações" 
                  primaryTypographyProps={{
                    fontWeight: currentPage === 'settings' ? 700 : 600,
                    color: 'white',
                    fontSize: '1rem',
                    letterSpacing: 0.5,
                    sx: {
                      textShadow: currentPage === 'settings' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          </motion.div>
        </List>
      </Box>
      
      {/* Footer do sidebar */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          p: 3,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <Box sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4CAF50',
              mr: 1,
              animation: 'pulse 2s infinite'
            }} />
            <Typography variant="caption" sx={{ 
              color: 'rgba(255,255,255,0.9)', 
              fontWeight: 600,
              fontSize: '0.75rem'
            }}>
              Sistema Online
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255,255,255,0.7)', 
            textAlign: 'center',
            display: 'block',
            fontSize: '0.7rem',
            letterSpacing: 0.5
          }}>
            v1.2.0 • 2025 • Pro
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );

  return (
    <>
      <GlobalStyles />
      <Box sx={{ display: 'flex', minHeight: '100vh', background: theme.palette.grey[50] }}>
      {/* Drawer lateral */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box', 
            background: 'transparent',
            border: 'none',
            boxShadow: isMobile ? '0 0 20px rgba(0,0,0,0.3)' : 'none'
          },
        }}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
      >
        {drawer}
      </Drawer>
      {/* Botão flutuante para abrir sidebar no mobile */}
      {isMobile && !drawerOpen && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              position: 'fixed',
              top: 20,
              left: 20,
              zIndex: theme.zIndex.drawer + 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              width: 56,
              height: 56,
              boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                transform: 'scale(1.1)',
                boxShadow: '0 12px 35px rgba(102, 126, 234, 0.6)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <MenuIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </motion.div>
      )}

      {/* Conteúdo principal */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 4 }, 
          fontFamily: 'Inter, Roboto Flex, sans-serif',
          ml: { xs: 0, md: drawerOpen ? 0 : 0 }, // Remover margem fixa
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}
      >
        {/* Cabeçalho da página */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ 
            mb: 4, 
            p: 3, 
            background: 'rgba(255,255,255,0.95)', 
            borderRadius: 4, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1
            }}>
              {currentPage === 'tables' && 'Gerenciamento de Mesas'}
              {currentPage === 'menu' && 'Cardápio & Produtos'}
              {currentPage === 'orders' && 'Histórico de Pedidos'}
              {currentPage === 'settings' && 'Configurações do Sistema'}
            </Typography>
            <Typography variant="body1" sx={{ 
              color: 'text.secondary',
              fontWeight: 500
            }}>
              {currentPage === 'tables' && 'Adicione, remova e gerencie as mesas do restaurante'}
              {currentPage === 'menu' && 'Gerencie produtos, categorias, adicionais e variações'}
              {currentPage === 'orders' && 'Visualize e acompanhe todos os pedidos realizados'}
              {currentPage === 'settings' && 'Configure as preferências do sistema'}
            </Typography>
          </Box>
        </motion.div>

        {/* SPA interna: Mesas/Cardápio */}
        {currentPage === 'tables' && (
          <Grid container spacing={4} justifyContent="center">
            <Grid size={{ xs: 12, md: 7, lg: 5 }}>
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <Card sx={{ p: 2, minHeight: 320, display: 'flex', flexDirection: 'column', boxShadow: 3, borderRadius: 4, background: 'rgba(255,255,255,0.97)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 7 } }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
                    Mesas
                  </Typography>
                  {loading ? <Box sx={{ textAlign:'center', mt:4 }}><CircularProgress /></Box> : (
                    <List dense>
                      {tables.map(t => (
                        <motion.div key={t.id} whileHover={{ scale: 1.03 }}>
                          <ListItem secondaryAction={
                            <Box>
                              <IconButton onClick={()=>openQr(t.number)} title="Ver QR Code" color="primary" sx={{ mx: 0.5 }}><QrCodeIcon /></IconButton>
                              <IconButton onClick={()=>removeTable(t.id)} title="Remover" color="error" sx={{ mx: 0.5 }}><DeleteIcon /></IconButton>
                            </Box>
                          } sx={{ borderRadius: 2, mb: 0.5, transition: 'background 0.2s', '&:hover': { background: 'rgba(33,150,243,0.04)' } }}>
                            <ListItemText primary={<b>Mesa {t.number}</b>} />
                          </ListItem>
                        </motion.div>
                      ))}
                    </List>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <TextField label="Nova mesa" size="small" value={newTable} onChange={e=>setNewTable(e.target.value)} type="number" sx={{ flex: 1 }} />
                    <Button onClick={addTable} variant="contained" startIcon={<AddIcon />} color="primary" sx={{ fontWeight: 700, borderRadius: 3, boxShadow: 1 }}>Adicionar</Button>
                  </Box>
                </CardContent>
              </Card>
              </motion.div>
            </Grid>
          </Grid>
        )}
        {currentPage === 'menu' && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card sx={{ p: 3, borderRadius: 4, boxShadow: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RestaurantMenuIcon /> Cardápio
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openCategoryDialog()}
                        sx={{ borderRadius: 2 }}
                      >
                        Categorias
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openAddonDialog()}
                        sx={{ borderRadius: 2 }}
                      >
                        Adicionais
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openMenuDialog()}
                        sx={{ borderRadius: 2 }}
                      >
                        Novo Item
                      </Button>
                    </Box>
                  </Box>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {menu.map(m => (
                        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} key={m.id}>
                          <motion.div whileHover={{ scale: 1.03, boxShadow: '0 8px 32px 0 rgba(33,150,243,0.18)' }}>
                            <Card sx={{ mb: 2, boxShadow: 1, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s' }}>
                              {m.image_url && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}><Box sx={{ width:'100%', height: 120, background: `url(${m.image_url}) center/cover`, borderRadius: 2 }} /></motion.div>}
                              <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{m.name}</Typography>
                                  {m.categories && (
                                    <Chip 
                                      label={m.categories.name} 
                                      size="small" 
                                      color="primary" 
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{m.description}</Typography>
                                <Typography variant="subtitle2" color="primary">R$ {Number(m.price).toFixed(2)}</Typography>
                              </CardContent>
                              <CardActions sx={{ justifyContent: 'flex-end', pb: 1 }}>
                                <IconButton onClick={()=>openMenuDialog(m)} title="Editar" color="primary"><EditIcon /></IconButton>
                                <IconButton onClick={()=>removeMenu(m.id)} title="Remover" color="error"><DeleteIcon /></IconButton>
                              </CardActions>
                            </Card>
                          </motion.div>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            </Grid>
          </Grid>
        )}
        {currentPage === 'orders' && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card sx={{ p: 2, minHeight: 320, display: 'flex', flexDirection: 'column', boxShadow: 3, borderRadius: 4, background: 'rgba(255,255,255,0.97)' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
                      Status das Mesas
                    </Typography>
                    {loading ? <Box sx={{ textAlign:'center', mt:4 }}><CircularProgress /></Box> : (
                      <Grid container spacing={2}>
                        {tables.map(table => {
                          // Determinar a cor de fundo com base no status
                          let bgColor = 'success.light'; // Disponível
                          let statusText = 'Disponível';
                          let statusIcon = <CheckCircleIcon />;
                          
                          if (table.status === 'occupied') {
                            bgColor = 'error.light';
                            statusText = 'Ocupada';
                            statusIcon = <EventBusyIcon />;
                          } else if (table.status === 'reserved') {
                            bgColor = 'warning.light';
                            statusText = 'Reservada';
                            statusIcon = <EventSeatIcon />;
                          }
                          
                          return (
                            <Grid size={{ xs: 6, sm: 4 }} key={table.id}>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Card 
                                  sx={{ 
                                    p: 1.5, 
                                    bgcolor: bgColor,
                                    color: 'white',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    boxShadow: 2,
                                    borderRadius: 2,
                                    transition: 'transform 0.2s'
                                  }}
                                  onClick={() => openTableStatusDialog(table)}
                                >
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                      Mesa {table.number}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      {statusIcon}
                                      <Typography variant="body2">
                                        {statusText}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Card>
                              </motion.div>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <Card sx={{ p: 2, minHeight: 320, display: 'flex', flexDirection: 'column', boxShadow: 3, borderRadius: 4, background: 'rgba(255,255,255,0.97)' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
                        Pedidos Ativos
                      </Typography>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={createTestOrder}
                        disabled={loading}
                      >
                        Criar Pedido Teste
                      </Button>
                    </Box>
                    {loadingOrders ? <Box sx={{ textAlign:'center', mt:4 }}><CircularProgress /></Box> : (
                      <List sx={{ width: '100%' }}>
                        {orders.filter(order => order.status !== 'completed').length === 0 ? (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <Typography>Nenhum pedido ativo no momento</Typography>
                          </Box>
                        ) : (
                          // Agrupar pedidos por mesa
                          Object.entries(
                            orders
                              .filter(order => order.status !== 'completed')
                              .reduce((grouped, order) => {
                                const tableId = order.table_id;
                                if (!grouped[tableId]) {
                                  grouped[tableId] = [];
                                }
                                grouped[tableId].push(order);
                                return grouped;
                              }, {})
                          ).map(([tableId, tableOrders]) => {
                            // Converter para array tipado
                            const ordersArray = tableOrders as any[];
                            const table = tables.find(t => t.id === Number(tableId));
                            
                            // Calcular o total da mesa
                            const totalValue = ordersArray.reduce(
                              (acc, order) => acc + Number(order.total || 0), 
                              0
                            );
                            
                            // Verificar status dos pedidos da mesa
                            const hasReady = ordersArray.some(order => order.status === 'ready');
                            const hasPreparing = ordersArray.some(order => order.status === 'preparing');
                            const hasPending = ordersArray.some(order => order.status === 'pending');
                            
                            // Determinar o status geral da mesa
                            let statusText = 'Pendente';
                            let statusColor = 'warning.main';
                            let statusIcon = <AccessTimeIcon fontSize="small" />;
                            
                            if (hasReady && !hasPreparing && !hasPending) {
                              statusText = 'Pronto para servir';
                              statusColor = 'success.main';
                              statusIcon = <DoneAllIcon fontSize="small" />;
                            } else if (hasPreparing) {
                              statusText = 'Em preparo';
                              statusColor = 'info.main';
                              statusIcon = <EmojiFoodBeverageIcon fontSize="small" />;
                            }
                            
                            return (
                              <ListItem 
                                key={tableId} 
                                sx={{ 
                                  p: 0, 
                                  mb: 2, 
                                  display: 'block' 
                                }}
                              >
                                <motion.div whileHover={{ scale: 1.01 }}>
                                  <Card sx={{ 
                                    borderRadius: 2, 
                                    boxShadow: 1, 
                                    bgcolor: 'grey.50',
                                    overflow: 'visible'
                                  }}>
                                    <CardContent>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                          Mesa {table?.number || tableId}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          <Box 
                                            sx={{ 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              bgcolor: `${statusColor}15`, 
                                              color: statusColor,
                                              px: 1,
                                              py: 0.5,
                                              borderRadius: 1,
                                              mr: 1
                                            }}
                                          >
                                            {statusIcon}
                                            <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 'medium' }}>
                                              {statusText}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Box>
                                      
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {ordersArray.length} {ordersArray.length === 1 ? 'pedido' : 'pedidos'} • R$ {totalValue.toFixed(2)}
                                      </Typography>
                                      
                                      <Box sx={{ mt: 2 }}>
                                        <Button 
                                          size="small" 
                                          variant="outlined" 
                                          onClick={() => viewOrderDetails(ordersArray[0])}
                                          sx={{ mr: 1 }}
                                        >
                                          Ver Detalhes
                                        </Button>
                                        <Button 
                                          size="small" 
                                          variant="contained" 
                                          color="primary"
                                          onClick={() => openPaymentDialog(ordersArray[0], ordersArray)}
                                          startIcon={<PaymentIcon />}
                                        >
                                          Pagamento
                                        </Button>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              </ListItem>
                            );
                          })
                        )}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', boxShadow: 3, borderRadius: 4, background: 'rgba(255,255,255,0.97)' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
                      Histórico de Pedidos
                    </Typography>
                    {loadingOrders ? <Box sx={{ textAlign:'center', mt:4 }}><CircularProgress /></Box> : (
                      <List sx={{ width: '100%' }}>
                        {orders
                          .filter(order => order.status === 'completed')
                          .slice(0, 5) // Mostrar apenas os 5 mais recentes
                          .map(order => {
                            // Encontrar a mesa correspondente
                            const table = tables.find(t => t.id === order.table_id);
                            // Encontrar os itens deste pedido
                            const items = orderItems.filter(item => item.order_id === order.id);
                            // Calcular o total
                            const total = order.total || items.reduce((sum, item) => {
                              return sum + (item.quantity * (item.menu_items?.price || 0));
                            }, 0);
                            
                            return (
                              <motion.div key={order.id} whileHover={{ scale: 1.01 }}>
                                <Card sx={{ mb: 2, borderRadius: 2, boxShadow: 1, bgcolor: 'grey.50' }}>
                                  <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                        Mesa {table?.number || order.table_id}
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <DoneAllIcon fontSize="small" color="success" />
                                        <Typography variant="body2" color="text.secondary">
                                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary">
                                      {items.length} {items.length === 1 ? 'item' : 'itens'} • R$ {total.toFixed(2)}
                                    </Typography>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                          
                        {orders.filter(order => order.status === 'completed').length === 0 && (
                          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            <ReceiptIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                            <Typography>Nenhum pedido finalizado</Typography>
                          </Box>
                        )}
                      </List>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        )}
        {currentPage === 'settings' && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Card sx={{ p: 3, borderRadius: 4, boxShadow: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SettingsIcon /> Configurações
                    </Typography>
                  </Box>
                  <Typography variant="body1" color="text.secondary" align="center">
                    Em breve você poderá personalizar todas as configurações do sistema aqui!
                  </Typography>
                </CardContent>
              </Card>
              </motion.div>
            </Grid>
          </Grid>
        )}
        {/* Dialog CRUD Cardápio */}
        <Dialog open={menuDialog} onClose={closeMenuDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingMenu?'Editar':'Novo'} item do cardápio</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {/* Informações básicas */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Informações Básicas</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      label="Nome" 
                      fullWidth 
                      value={menuForm.name} 
                      onChange={e=>setMenuForm(f=>({...f,name:e.target.value}))} 
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Categoria</InputLabel>
                      <Select
                        value={menuForm.category_id}
                        label="Categoria"
                        onChange={e=>setMenuForm(f=>({...f,category_id:e.target.value}))}
                      >
                        <MenuItem value="">Sem categoria</MenuItem>
                        {categories.map(cat => (
                          <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField 
                      label="Descrição" 
                      fullWidth 
                      multiline 
                      rows={2}
                      value={menuForm.description} 
                      onChange={e=>setMenuForm(f=>({...f,description:e.target.value}))} 
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      label="Preço Base" 
                      fullWidth 
                      value={menuForm.price} 
                      onChange={e=>setMenuForm(f=>({...f,price:e.target.value}))} 
                      type="number"
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography>
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Imagem do Produto
                      </Typography>
                      
                      {/* Preview da imagem atual */}
                      {(menuForm.image_url || selectedImageFile) && (
                        <Box sx={{ mb: 2 }}>
                          <img 
                            src={selectedImageFile ? URL.createObjectURL(selectedImageFile) : menuForm.image_url} 
                            alt="Preview" 
                            style={{ 
                              width: '100%', 
                              maxWidth: '200px', 
                              height: '120px', 
                              objectFit: 'cover', 
                              borderRadius: '8px',
                              border: '1px solid #ddd'
                            }} 
                          />
                        </Box>
                      )}
                      
                      {/* Input de arquivo escondido */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageFileSelect}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                      />
                      
                      {/* Botões */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          variant="outlined"
                          startIcon={<CloudUploadIcon />}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                        >
                          {selectedImageFile ? 'Trocar Imagem' : 'Selecionar Imagem'}
                        </Button>
                        
                        {selectedImageFile && (
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              setSelectedImageFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                        
                        {menuForm.image_url && !selectedImageFile && (
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setMenuForm(f => ({...f, image_url: ''}))}
                          >
                            Remover Imagem
                          </Button>
                        )}
                      </Box>
                      
                      {selectedImageFile && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Arquivo selecionado: {selectedImageFile.name}
                        </Typography>
                      )}
                      
                      {uploadingImage && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="caption">Fazendo upload...</Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Variações de tamanho */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Variações de Tamanho</Typography>
                {sizeVariants.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    {sizeVariants.map((variant, index) => (
                      <Card key={index} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{variant.size_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {variant.price_modifier >= 0 ? '+' : ''}R$ {Number(variant.price_modifier).toFixed(2)}
                              {variant.is_default && ' (Padrão)'}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => removeSizeVariant(index)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                )}
                
                <Card sx={{ p: 2, bgcolor: 'primary.light', color: 'white' }}>
                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>Adicionar Nova Variação</Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        size="small"
                        label="Tamanho"
                        fullWidth
                        value={newSizeVariant.size_name}
                        onChange={e => setNewSizeVariant(prev => ({...prev, size_name: e.target.value}))}
                        placeholder="Ex: Pequeno, Médio, Grande"
                        sx={{ bgcolor: 'white', borderRadius: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        size="small"
                        label="Diferença no preço"
                        fullWidth
                        type="number"
                        value={newSizeVariant.price_modifier}
                        onChange={e => setNewSizeVariant(prev => ({...prev, price_modifier: e.target.value}))}
                        placeholder="Ex: 0, 5.00, -2.00"
                        sx={{ bgcolor: 'white', borderRadius: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newSizeVariant.is_default}
                            onChange={e => setNewSizeVariant(prev => ({...prev, is_default: e.target.checked}))}
                            sx={{ color: 'white' }}
                          />
                        }
                        label="Padrão"
                        sx={{ color: 'white' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 2 }}>
                      <Button 
                        variant="contained" 
                        size="small" 
                        onClick={addSizeVariant}
                        sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                      >
                        <AddIcon fontSize="small" />
                      </Button>
                    </Grid>
                  </Grid>
                </Card>
              </Box>

              {/* Adicionais */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Adicionais Disponíveis</Typography>
                <Card sx={{ p: 2 }}>
                  {addons.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Nenhum adicional cadastrado</Typography>
                  ) : (
                    <Grid container spacing={1}>
                      {addons.map(addon => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={addon.id}>
                          <Card 
                            sx={{ 
                              p: 1, 
                              cursor: 'pointer',
                              bgcolor: selectedAddons.includes(addon.id) ? 'primary.light' : 'grey.50',
                              color: selectedAddons.includes(addon.id) ? 'white' : 'text.primary',
                              border: selectedAddons.includes(addon.id) ? '2px solid' : '1px solid',
                              borderColor: selectedAddons.includes(addon.id) ? 'primary.main' : 'grey.300'
                            }}
                            onClick={() => toggleAddon(addon.id)}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{addon.name}</Typography>
                                <Typography variant="caption">R$ {Number(addon.price).toFixed(2)}</Typography>
                              </Box>
                              <Checkbox 
                                checked={selectedAddons.includes(addon.id)}
                                size="small"
                                sx={{ color: selectedAddons.includes(addon.id) ? 'white' : 'primary.main' }}
                              />
                            </Box>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Card>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeMenuDialog}>Cancelar</Button>
            <Button onClick={saveMenu} variant="contained">Salvar</Button>
          </DialogActions>
        </Dialog>
        {/* QR Code Dialog */}
      <Dialog open={qrTable !== null} onClose={closeQr} maxWidth="xs" fullWidth>
        <DialogTitle>QR Code - Mesa {qrTable}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {typeof window !== 'undefined' && (
            <QRCodeSVG value={`${window.location.origin}/menu?table=${qrTable}`} size={200} />
          )}
          <Typography variant="body2" sx={{ mt: 2 }}>
            Escaneie este QR code para acessar o cardápio digital da Mesa {qrTable}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeQr}>Fechar</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog para atualizar status da mesa */}
      <Dialog open={tableStatusDialog} onClose={closeTableStatusDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Gerenciar Mesa {selectedTable?.number}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Selecione o status atual desta mesa:
          </Typography>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'success.light',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: 2,
                    borderRadius: 2
                  }}
                  onClick={() => updateTableStatus('available')}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 36, mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Disponível
                    </Typography>
                  </Box>
                </Card>
              </motion.div>
            </Grid>
            
            <Grid size={{ xs: 4 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'error.light',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: 2,
                    borderRadius: 2
                  }}
                  onClick={() => updateTableStatus('occupied')}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <EventBusyIcon sx={{ fontSize: 36, mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Ocupada
                    </Typography>
                  </Box>
                </Card>
              </motion.div>
            </Grid>
            
            <Grid size={{ xs: 4 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Card 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'warning.light',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: 2,
                    borderRadius: 2
                  }}
                  onClick={() => updateTableStatus('reserved')}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <EventSeatIcon sx={{ fontSize: 36, mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Reservada
                    </Typography>
                  </Box>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
          
          {selectedTable?.status === 'reserved' && (
            <TextField
              margin="dense"
              label="Nome da reserva"
              fullWidth
              variant="outlined"
              value={reservationName}
              onChange={(e) => setReservationName(e.target.value)}
              sx={{ mt: 3 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTableStatusDialog}>Cancelar</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog para detalhes do pedido */}
      <Dialog open={selectedOrder !== null && !paymentDialog} onClose={closeOrderDetails} maxWidth="sm" fullWidth>
        {selectedOrder && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Detalhes do Pedido</Typography>
                <IconButton onClick={closeOrderDetails} size="small">
                  <ArrowBackIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', color: 'white', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Mesa {tables.find(t => t.id === selectedOrder.table_id)?.number || selectedOrder.table_id}
                </Typography>
                <Typography variant="body2">
                  Pedido #{selectedOrder.id} • {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                </Typography>
              </Box>
              
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Itens do Pedido:
              </Typography>
              
              <List>
                {orderItems
                  .filter(item => item.order_id === selectedOrder.id)
                  .map(item => {
                    // Calcular preço unitário considerando variação de tamanho
                    const basePrice = item.menu_items?.price || 0;
                    const sizeModifier = item.size_variant?.price_modifier || 0;
                    const unitPrice = basePrice + sizeModifier;
                    
                    // Calcular preço dos adicionais
                    const addonsPrice = (item.addons || []).reduce((sum, addon) => sum + addon.price, 0);
                    
                    // Preço total do item (unitário + adicionais) * quantidade
                    const itemTotal = (unitPrice + addonsPrice) * item.quantity;
                    
                    return (
                      <ListItem key={item.id} sx={{ py: 1, px: 0, borderBottom: '1px solid #eee', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              {item.menu_items?.name || `Item #${item.menu_item_id}`}
                            </Typography>
                            
                            {/* Variação de tamanho */}
                            {item.size_variant && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Tamanho: {item.size_variant.size_name} 
                                {sizeModifier !== 0 && ` (${sizeModifier > 0 ? '+' : ''}R$ ${sizeModifier.toFixed(2)})`}
                              </Typography>
                            )}
                            
                            {/* Adicionais */}
                            {item.addons && item.addons.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Adicionais:
                                </Typography>
                                {item.addons.map((addon, index) => (
                                  <Typography key={index} variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                    • {addon.name} (+R$ {addon.price.toFixed(2)})
                                  </Typography>
                                ))}
                              </Box>
                            )}
                            
                            {/* Observações */}
                            {item.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                Obs: {item.notes}
                              </Typography>
                            )}
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              {item.quantity}x
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              R$ {itemTotal.toFixed(2)}
                            </Typography>
                          </Box>
                        </Box>
                      </ListItem>
                    );
                  })}
              </List>
              
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Total: R$ {
                    (selectedOrder.total || orderItems
                      .filter(item => item.order_id === selectedOrder.id)
                      .reduce((sum, item) => {
                        const basePrice = item.menu_items?.price || 0;
                        const sizeModifier = item.size_variant?.price_modifier || 0;
                        const unitPrice = basePrice + sizeModifier;
                        const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0);
                        return sum + ((unitPrice + addonsPrice) * item.quantity);
                      }, 0)
                    ).toFixed(2)
                  }
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeOrderDetails}>Voltar</Button>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<PaymentIcon />}
                onClick={() => openPaymentDialog(selectedOrder)}
              >
                Pagamento
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Dialog para pagamento */}
      <Dialog open={paymentDialog} onClose={closePaymentDialog} maxWidth="sm" fullWidth>
        {selectedOrder && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Finalizar Pedido</Typography>
                <IconButton onClick={closePaymentDialog} size="small">
                  <ArrowBackIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3, p: 2, bgcolor: 'success.light', color: 'white', borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Mesa {tables.find(t => t.id === selectedOrder.table_id)?.number || selectedOrder.table_id}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  Total: R$ {
                    // Verificar se temos pedidos agrupados
                    selectedOrder.allTableOrders
                      ? (
                          // Calcular o total de todos os pedidos da mesa
                          selectedOrder.allTableOrders.reduce((total, order) => {
                            // Para cada pedido, somar o total ou calcular a partir dos itens
                            const orderTotal = order.total || orderItems
                              .filter(item => item.order_id === order.id)
                              .reduce((sum, item) => {
                                const basePrice = item.menu_items?.price || 0;
                                const sizeModifier = item.size_variant?.price_modifier || 0;
                                const unitPrice = basePrice + sizeModifier;
                                const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0);
                                return sum + ((unitPrice + addonsPrice) * item.quantity);
                              }, 0);
                            return total + Number(orderTotal);
                          }, 0)
                        )
                      : (
                          // Cálculo para um único pedido (compatibilidade)
                          selectedOrder.total || orderItems
                            .filter(item => item.order_id === selectedOrder.id)
                            .reduce((sum, item) => {
                              const basePrice = item.menu_items?.price || 0;
                              const sizeModifier = item.size_variant?.price_modifier || 0;
                              const unitPrice = basePrice + sizeModifier;
                              const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0);
                              return sum + ((unitPrice + addonsPrice) * item.quantity);
                            }, 0)
                        )
                  }.toFixed(2)
                </Typography>
              </Box>
              
              <Typography variant="body1" sx={{ mb: 3 }}>
                Confirme o recebimento do pagamento para finalizar este pedido, imprimir a comanda e liberar a mesa (se não houver outros pedidos ativos para ela).
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Card sx={{ p: 2, width: 100, textAlign: 'center', boxShadow: 2, borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Forma de Pagamento</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 1 }}>Dinheiro</Typography>
                  </Card>
                </motion.div>
                
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Card sx={{ p: 2, width: 100, textAlign: 'center', boxShadow: 2, borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Forma de Pagamento</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 1 }}>Cartão</Typography>
                  </Card>
                </motion.div>
                
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Card sx={{ p: 2, width: 100, textAlign: 'center', boxShadow: 2, borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Forma de Pagamento</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 1 }}>Pix</Typography>
                  </Card>
                </motion.div>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={closePaymentDialog}>Cancelar</Button>
              <Button 
                variant="contained" 
                color="success" 
                startIcon={printingOrder ? <CircularProgress size={20} color="inherit" /> : <PrintIcon />}
                onClick={completeOrder}
                disabled={printingOrder}
              >
                {printingOrder ? 'Imprimindo...' : 'Imprimir e Finalizar'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Componente oculto para impressão */}
      <div style={{ display: 'none' }}>
        <div ref={printComponentRef}>
          <Paper sx={{ p: 3, maxWidth: '80mm', margin: '0 auto' }}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Restaurante QR Menu
              </Typography>
              <Typography variant="body2">
                CNPJ: 00.000.000/0001-00
              </Typography>
              <Typography variant="body2">
                {new Date().toLocaleDateString('pt-BR')}
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {selectedOrder && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    COMANDA - MESA {tables.find(t => t.id === selectedOrder.table_id)?.number || selectedOrder.table_id}
                  </Typography>
                  <Typography variant="body2">
                    Pedido #{selectedOrder.id}
                  </Typography>
                  <Typography variant="body2">
                    {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
                
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  ITENS
                </Typography>
                
                {/* Verificar se temos pedidos agrupados */}
                {selectedOrder.allTableOrders ? (
                  // Mostrar todos os itens de todos os pedidos da mesa
                  selectedOrder.allTableOrders.flatMap(order => 
                    orderItems
                      .filter(item => item.order_id === order.id)
                      .map((item, index) => {
                        const basePrice = item.menu_items?.price || 0;
                        const sizeModifier = item.size_variant?.price_modifier || 0;
                        const unitPrice = basePrice + sizeModifier;
                        const addonsPrice = (item.addons || []).reduce((sum, addon) => sum + addon.price, 0);
                        const itemTotal = (unitPrice + addonsPrice) * item.quantity;
                        
                        return (
                          <Box key={`${order.id}-${item.id}`} sx={{ mb: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">
                                {item.quantity}x {item.menu_items?.name || `Item #${item.menu_item_id}`}
                              </Typography>
                              <Typography variant="body2">
                                R$ {itemTotal.toFixed(2)}
                              </Typography>
                            </Box>
                            
                            {/* Variação de tamanho */}
                            {item.size_variant && (
                              <Typography variant="caption" sx={{ display: 'block', ml: 2, color: 'text.secondary' }}>
                                {item.size_variant.size_name}
                                {sizeModifier !== 0 && ` (${sizeModifier > 0 ? '+' : ''}R$ ${sizeModifier.toFixed(2)})`}
                              </Typography>
                            )}
                            
                            {/* Adicionais */}
                            {item.addons && item.addons.length > 0 && item.addons.map((addon, addonIndex) => (
                              <Typography key={addonIndex} variant="caption" sx={{ display: 'block', ml: 2, color: 'text.secondary' }}>
                                + {addon.name} (R$ {addon.price.toFixed(2)})
                              </Typography>
                            ))}
                            
                            {/* Observações */}
                            {item.notes && (
                              <Typography variant="caption" sx={{ display: 'block', ml: 2, fontStyle: 'italic' }}>
                                Obs: {item.notes}
                              </Typography>
                            )}
                          </Box>
                        );
                      })
                  )
                ) : (
                  // Mostrar apenas os itens do pedido selecionado (compatibilidade)
                  orderItems
                    .filter(item => item.order_id === selectedOrder.id)
                    .map((item, index) => {
                      const basePrice = item.menu_items?.price || 0;
                      const sizeModifier = item.size_variant?.price_modifier || 0;
                      const unitPrice = basePrice + sizeModifier;
                      const addonsPrice = (item.addons || []).reduce((sum, addon) => sum + addon.price, 0);
                      const itemTotal = (unitPrice + addonsPrice) * item.quantity;
                      
                      return (
                        <Box key={item.id} sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              {item.quantity}x {item.menu_items?.name || `Item #${item.menu_item_id}`}
                            </Typography>
                            <Typography variant="body2">
                              R$ {itemTotal.toFixed(2)}
                            </Typography>
                          </Box>
                          
                          {/* Variação de tamanho */}
                          {item.size_variant && (
                            <Typography variant="caption" sx={{ display: 'block', ml: 2, color: 'text.secondary' }}>
                              {item.size_variant.size_name}
                              {sizeModifier !== 0 && ` (${sizeModifier > 0 ? '+' : ''}R$ ${sizeModifier.toFixed(2)})`}
                            </Typography>
                          )}
                          
                          {/* Adicionais */}
                          {item.addons && item.addons.length > 0 && item.addons.map((addon, addonIndex) => (
                            <Typography key={addonIndex} variant="caption" sx={{ display: 'block', ml: 2, color: 'text.secondary' }}>
                              + {addon.name} (R$ {addon.price.toFixed(2)})
                            </Typography>
                          ))}
                          
                          {/* Observações */}
                          {item.notes && (
                            <Typography variant="caption" sx={{ display: 'block', ml: 2, fontStyle: 'italic' }}>
                              Obs: {item.notes}
                            </Typography>
                          )}
                        </Box>
                      );
                    })
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    TOTAL
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    R$ {
                      // Verificar se temos pedidos agrupados
                      selectedOrder.allTableOrders
                        ? (
                            // Calcular o total de todos os pedidos da mesa
                            selectedOrder.allTableOrders.reduce((total, order) => {
                              // Para cada pedido, somar o total ou calcular a partir dos itens
                              const orderTotal = order.total || orderItems
                                .filter(item => item.order_id === order.id)
                                .reduce((sum, item) => {
                                  const basePrice = item.menu_items?.price || 0;
                                  const sizeModifier = item.size_variant?.price_modifier || 0;
                                  const unitPrice = basePrice + sizeModifier;
                                  const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0);
                                  return sum + ((unitPrice + addonsPrice) * item.quantity);
                                }, 0);
                              return total + Number(orderTotal);
                            }, 0)
                          )
                        : (
                            // Cálculo para um único pedido (compatibilidade)
                            selectedOrder.total || orderItems
                              .filter(item => item.order_id === selectedOrder.id)
                              .reduce((sum, item) => {
                                const basePrice = item.menu_items?.price || 0;
                                const sizeModifier = item.size_variant?.price_modifier || 0;
                                const unitPrice = basePrice + sizeModifier;
                                const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0);
                                return sum + ((unitPrice + addonsPrice) * item.quantity);
                              }, 0)
                          )
                    }.toFixed(2)
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ textAlign: 'center', mt: 3 }}>
                  <Typography variant="body2">
                    Obrigado pela preferência!
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    www.restauranteqrmenu.com.br
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </div>
      </div>
        {/* Snackbar feedback */}
        <Snackbar
         
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={()=>setSnackbar(s=>({...s,open:false}))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} variant="filled" sx={{ fontWeight: 500 }}>{snackbar.message}</Alert>
        </Snackbar>

        {/* Dialog para gerenciar categorias */}
        <Dialog open={categoryDialog} onClose={closeCategoryDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle>
          <DialogContent>
            <TextField 
              label="Nome" 
              fullWidth 
              margin="dense" 
              value={categoryForm.name} 
              onChange={e=>setCategoryForm(f=>({...f,name:e.target.value}))} 
            />
            <TextField 
              label="Descrição" 
              fullWidth 
              margin="dense" 
              multiline
              rows={2}
              value={categoryForm.description} 
              onChange={e=>setCategoryForm(f=>({...f,description:e.target.value}))} 
            />
            <TextField 
              label="Ordem de exibição" 
              fullWidth 
              margin="dense" 
              type="number"
              value={categoryForm.display_order} 
              onChange={e=>setCategoryForm(f=>({...f,display_order:e.target.value}))} 
            />
            
            {/* Lista de categorias existentes */}
            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Categorias Existentes</Typography>
            <Grid container spacing={2}>
              {categories.map(category => (
                <Grid size={{ xs: 12, sm: 6 }} key={category.id}>
                  <Card sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {category.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {category.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Ordem: {category.display_order}
                        </Typography>
                      </Box>
                      <Box>
                        <IconButton onClick={() => openCategoryDialog(category)} size="small" color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton onClick={() => removeCategory(category.id)} size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCategoryDialog}>Fechar</Button>
            <Button onClick={saveCategory} variant="contained">Salvar</Button>
          </DialogActions>
        </Dialog>

        {/* Dialog para gerenciar adicionais */}
        <Dialog open={addonDialog} onClose={closeAddonDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingAddon ? 'Editar' : 'Novo'} Adicional</DialogTitle>
          <DialogContent>
            <TextField 
              label="Nome" 
              fullWidth 
              margin="dense" 
              value={addonForm.name} 
              onChange={e=>setAddonForm(f=>({...f,name:e.target.value}))} 
            />
            <TextField 
              label="Descrição" 
              fullWidth 
              margin="dense" 
              multiline
              rows={2}
              value={addonForm.description} 
              onChange={e=>setAddonForm(f=>({...f,description:e.target.value}))} 
            />
            <TextField 
              label="Preço (R$)" 
              fullWidth 
              margin="dense" 
              type="number"
              value={addonForm.price} 
              onChange={e=>setAddonForm(f=>({...f,price:e.target.value}))} 
            />
            
            {/* Lista de adicionais existentes */}
            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Adicionais Existentes</Typography>
            <Grid container spacing={2}>
              {addons.map(addon => (
                <Grid size={{ xs: 12, sm: 6 }} key={addon.id}>
                  <Card sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {addon.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {addon.description}
                        </Typography>
                        <Typography variant="subtitle2" color="primary">
                          R$ {Number(addon.price).toFixed(2)}
                        </Typography>
                      </Box>
                      <Box>
                        <IconButton onClick={() => openAddonDialog(addon)} size="small" color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton onClick={() => removeAddon(addon.id)} size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAddonDialog}>Fechar</Button>
            <Button onClick={saveAddon} variant="contained">Salvar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
    </>
  );
}
