import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User as UserIcon, Loader2, ChevronDown, CheckCircle2, XCircle, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { icon: Clock, label: 'En attente', color: 'text-muted-foreground' },
  running: { icon: Loader2, label: 'En cours', color: 'text-blue-500', spin: true },
  in_progress: { icon: Loader2, label: 'En cours', color: 'text-blue-500', spin: true },
  completed: { icon: CheckCircle2, label: 'Terminé', color: 'text-emerald-600' },
  success: { icon: CheckCircle2, label: 'Réussi', color: 'text-emerald-600' },
  failed: { icon: XCircle, label: 'Échec', color: 'text-destructive' },
  error: { icon: XCircle, label: 'Erreur', color: 'text-destructive' }
};

function formatToolName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status || 'pending';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  const isFailed = status === 'failed' || status === 'error';
  const proj = toolCall.display_projection || {};
  const hideDetails = proj.hide_details && proj.details_redacted;

  let parsedArgs = toolCall.arguments_string;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { /* keep raw */ }

  let parsedResults = toolCall.results;
  if (typeof parsedResults === 'string') {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const resultIsError = typeof parsedResults === 'object' && parsedResults !== null &&
    (parsedResults.success === false || /error|failed/i.test(JSON.stringify(parsedResults)));

  return (
    <div className="mt-1.5 text-xs">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
          hideDetails ? "cursor-default" : "hover:bg-muted/60"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", config.color, config.spin && "animate-spin")} />
        <span className="font-medium text-foreground/80">{formatToolName(toolCall.name)}</span>
        <span className={config.color}>· {proj.active_label && (status === 'pending' || status === 'running' || status === 'in_progress') ? proj.active_label : isFailed ? (proj.error_label || config.label) : (proj.label || config.label)}</span>
        {!hideDetails && <ChevronDown className={cn("ml-0.5 h-3 w-3 transition-transform", expanded && "rotate-180")} />}
      </button>
      {expanded && !hideDetails && (
        <div className="mt-1 ml-5 space-y-1">
          {parsedArgs && (
            <div>
              <p className="font-semibold text-muted-foreground">Paramètres :</p>
              <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <p className="font-semibold text-muted-foreground">Résultat :</p>
              <pre className={cn("max-h-40 overflow-auto rounded p-2 text-[11px]", isFailed || resultIsError ? "bg-destructive/10 text-destructive" : "bg-emerald-500/5")}>{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isUser ? "bg-gd-navy text-white order-2" : "bg-gd-orange text-gd-navy-dark")}>
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5", isUser ? "bg-gd-navy text-white order-1" : "bg-card border border-border")}>
        {message.content && (
          isUser
            ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            : <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">{message.content}</ReactMarkdown>
        )}
        {message.tool_calls?.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}

export default function AgentChat({ agentName, title, subtitle, placeholder = "Posez votre question…" }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: agentName });
      setConversations(list || []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvos(false);
    }
  }, [agentName]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    const unsubscribe = base44.agents.subscribeToConversation(activeConversationId, (data) => {
      setMessages(data.messages || []);
      setIsSending(false);
    });
    return () => unsubscribe();
  }, [activeConversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewConversation = async () => {
    try {
      const convo = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: { name: `Session ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` }
      });
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages(convo.messages || []);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  };

  const handleSelectConversation = async (id) => {
    setActiveConversationId(id);
    try {
      const convo = await base44.agents.getConversation(id);
      setMessages(convo.messages || []);
    } catch {
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    let convoId = activeConversationId;

    if (!convoId) {
      try {
        const convo = await base44.agents.createConversation({
          agent_name: agentName,
          metadata: { name: input.slice(0, 40) }
        });
        setConversations((prev) => [convo, ...prev]);
        convoId = convo.id;
        setActiveConversationId(convoId);
      } catch (err) {
        console.error('Failed to create conversation', err);
        return;
      }
    }

    const content = input.trim();
    setInput('');
    setIsSending(true);
    setMessages((prev) => [...prev, { role: 'user', content }]);

    try {
      const convo = await base44.agents.getConversation(convoId);
      await base44.agents.addMessage(convo, { role: 'user', content });
    } catch (err) {
      console.error('Failed to send message', err);
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Sidebar - conversations list */}
      <div className={cn("flex flex-col border-r border-border bg-muted/30 transition-all", showSidebar ? "w-64" : "w-0")}>
        {showSidebar && (
          <>
            <div className="p-3 border-b border-border">
              <Button onClick={handleNewConversation} className="w-full" size="sm">
                + Nouvelle conversation
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingConvos ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : conversations.length === 0 ? (
                <p className="px-3 py-4 text-xs text-center text-muted-foreground">Aucune conversation. Lancez-en une nouvelle.</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={cn(
                      "w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      c.id === activeConversationId ? "bg-gd-navy text-white" : "hover:bg-muted"
                    )}
                  >
                    {c.metadata?.name || 'Conversation'}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => setShowSidebar(!showSidebar)} className="text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-5 w-5 transition-transform", showSidebar ? "-rotate-90" : "rotate-90")} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gd-orange/15 text-gd-orange">
                <Bot className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{subtitle || 'Posez votre première question pour commencer.'}</p>
            </div>
          ) : (
            messages.map((msg, idx) => <MessageBubble key={idx} message={msg} />)
          )}
          {isSending && (
            <div className="flex justify-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gd-orange text-gd-navy-dark">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-card border border-border px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || isSending} size="icon" className="h-9 w-9">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}