// Conversación de UN pedido entre el cliente y el socio.
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading, Notice, styles } from '../../components/ui';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { subscribeOrder } from '../../services/orders';
import { CHAT_MAX, chatIsOpen, sendMessage, subscribeMessages } from '../../services/chat';
import { registerPushToken } from '../../lib/notifications';
import { colors, fonts } from '../../constants/brand';
import { friendlyError } from '../../lib/errors';

const hour = (ts) => {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '';
};

export default function OrderChatScreen({ route }) {
  const { id } = route.params || {};
  const { user } = useAuth();
  const [order, setOrder] = useState(undefined);
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);

  useEffect(() => subscribeOrder(id, setOrder, (e) => setError(friendlyError(e))), [id]);
  const open = chatIsOpen(order);
  useEffect(() => {
    if (!order || !open) return undefined;
    return subscribeMessages(id, setMsgs, () => setMsgs([]));
  }, [id, !!order, open]);
  // Para recibir avisos de mensajes nuevos.
  useEffect(() => { if (user) registerPushToken(user.uid).catch(() => {}); }, [user?.uid]);

  if (order === undefined) return <Loading />;
  if (!order) return <View style={styles.page}><Notice tone="error">{error || 'Pedido no encontrado.'}</Notice></View>;
  const role = order.providerId === user?.uid ? 'provider' : 'customer';
  const other = role === 'provider' ? (order.customerName || 'Cliente') : (order.providerName || 'Lavandería');

  async function send() {
    if (!text.trim()) return;
    setSending(true); setError('');
    try { await sendMessage(id, { uid: user.uid, role, text }); setText(''); } catch (e) { setError(friendlyError(e)); } finally { setSending(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={s.head}>
          <Text style={s.headTitle} numberOfLines={1}>{other}</Text>
          <Text style={s.headSub}>Chat de este pedido. El equipo de BÜBÜ puede revisarlo para tu seguridad.</Text>
        </View>
        {!open ? (
          <View style={styles.page}><Notice tone="info">Este chat ya se cerró porque el pedido terminó.</Notice></View>
        ) : msgs === null ? <Loading /> : (
          <FlatList
            ref={list}
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center', marginTop: 30 }]}>Escribe para coordinar la entrega, el horario o el pago.</Text>}
            renderItem={({ item }) => {
              const mine = item.senderId === user?.uid;
              return (
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  <Text selectable style={[s.text, mine && { color: colors.white }]}>{item.text}</Text>
                  <Text style={[s.time, mine && { color: '#DCE8FF' }]}>{hour(item.createdAt)}</Text>
                </View>
              );
            }}
          />
        )}
        <Notice tone="error">{error}</Notice>
        {open && (
          <View style={s.bar}>
            <TextInput style={s.input} value={text} onChangeText={setText} placeholder="Escribe un mensaje…" placeholderTextColor="#9AA6B8" multiline maxLength={CHAT_MAX} />
            <Pressable onPress={send} disabled={sending || !text.trim()} style={[s.send, (sending || !text.trim()) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Enviar">
              <Icon name="send" size={20} color={colors.white} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  headTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.ink },
  headSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.blue, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  text: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, lineHeight: 20 },
  time: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginTop: 3, alignSelf: 'flex-end' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
