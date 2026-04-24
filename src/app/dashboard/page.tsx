"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Pencil, Copy, RefreshCw } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  maxConcurrency: number;
  credentials: Credential[];
}

interface Credential {
  id: string;
  name: string;
  isActive: boolean;
  models: { id: string; model: string }[];
  provider?: { name: string };
}

interface Mapping {
  id: string;
  alias: string;
  priority: number;
  isEnabled: boolean;
  credentialModel: {
    id: string;
    model: string;
    credential: {
      id: string;
      name: string;
      provider: { id: string; name: string };
    };
  };
}

interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
}

// Sortable Row Component for drag-and-drop
function SortableMappingRow({
  mapping,
  index,
  onToggle,
  onDelete,
}: {
  mapping: Mapping;
  index: number;
  onToggle: (id: string, isEnabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>{index + 1}</TableCell>
      <TableCell>{mapping.credentialModel.credential.provider.name}</TableCell>
      <TableCell>{mapping.credentialModel.credential.name}</TableCell>
      <TableCell>{mapping.credentialModel.model}</TableCell>
      <TableCell>
        <Switch
          checked={mapping.isEnabled}
          onCheckedChange={() => onToggle(mapping.id, mapping.isEnabled)}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onDelete(mapping.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Provider dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerMaxConcurrency, setProviderMaxConcurrency] = useState("10");

  // Credential dialog states
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<{ id: string; providerId: string; name: string; apiKey: string; models: { id: string; model: string }[] } | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [credentialName, setCredentialName] = useState("");
  const [credentialApiKey, setCredentialApiKey] = useState("");
  const [credentialModelsInput, setCredentialModelsInput] = useState("");

  // API Key dialog states
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");

  // Mapping dialog states
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingAlias, setMappingAlias] = useState<"nano" | "base" | "pro">("nano");
  const [mappingProviderId, setMappingProviderId] = useState("");
  const [mappingCredentialId, setMappingCredentialId] = useState("");
  const [mappingCredentialModelId, setMappingCredentialModelId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    try {
      const [providersRes, mappingsRes, apiKeysRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/mappings"),
        fetch("/api/user/api-key"),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers);
      }

      if (mappingsRes.ok) {
        const data = await mappingsRes.json();
        setMappings(data.mappings);
      }

      if (apiKeysRes.ok) {
        const data = await apiKeysRes.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // API Key handlers
  const handleCreateApiKey = async () => {
    try {
      const res = await fetch("/api/user/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newApiKeyName }),
      });
      if (res.ok) {
        setApiKeyDialogOpen(false);
        setNewApiKeyName("");
        fetchData();
      }
    } catch (error) {
      console.error("Create API key error:", error);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("确定要删除此 API Key 吗？")) return;
    try {
      await fetch(`/api/user/api-key/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Delete API key error:", error);
    }
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  // Provider handlers
  const handleCreateProvider = async () => {
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName,
          baseUrl: providerBaseUrl,
          maxConcurrency: parseInt(providerMaxConcurrency),
        }),
      });

      if (res.ok) {
        setProviderDialogOpen(false);
        resetProviderForm();
        fetchData();
      }
    } catch (error) {
      console.error("Create provider error:", error);
    }
  };

  const handleUpdateProvider = async () => {
    if (!editingProvider) return;
    try {
      const res = await fetch(`/api/providers/${editingProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName,
          baseUrl: providerBaseUrl,
          maxConcurrency: parseInt(providerMaxConcurrency),
        }),
      });

      if (res.ok) {
        setProviderDialogOpen(false);
        setEditingProvider(null);
        resetProviderForm();
        fetchData();
      }
    } catch (error) {
      console.error("Update provider error:", error);
    }
  };

  const resetProviderForm = () => {
    setProviderName("");
    setProviderBaseUrl("");
    setProviderMaxConcurrency("10");
  };

  const openEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setProviderName(provider.name);
    setProviderBaseUrl(provider.baseUrl);
    setProviderMaxConcurrency(provider.maxConcurrency.toString());
    setProviderDialogOpen(true);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("确定要删除此供应商吗？")) return;

    try {
      await fetch(`/api/providers/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Delete provider error:", error);
    }
  };

  // Credential handlers
  const handleCreateCredential = async () => {
    try {
      const models = credentialModelsInput
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId,
          name: credentialName,
          apiKey: credentialApiKey,
          models,
        }),
      });

      if (res.ok) {
        setCredentialDialogOpen(false);
        resetCredentialForm();
        fetchData();
      }
    } catch (error) {
      console.error("Create credential error:", error);
    }
  };

  const handleUpdateCredential = async () => {
    if (!editingCredential) return;
    try {
      const models = credentialModelsInput
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const res = await fetch(`/api/credentials/${editingCredential.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: credentialName,
          apiKey: credentialApiKey,
          models,
        }),
      });

      if (res.ok) {
        setCredentialDialogOpen(false);
        setEditingCredential(null);
        resetCredentialForm();
        fetchData();
      }
    } catch (error) {
      console.error("Update credential error:", error);
    }
  };

  const resetCredentialForm = () => {
    setSelectedProviderId("");
    setCredentialName("");
    setCredentialApiKey("");
    setCredentialModelsInput("");
  };

  const openEditCredential = (providerId: string, credential: Credential) => {
    setEditingCredential({
      id: credential.id,
      providerId,
      name: credential.name,
      apiKey: "", // 不显示现有 API Key
      models: credential.models,
    });
    setSelectedProviderId(providerId);
    setCredentialName(credential.name);
    setCredentialApiKey("");
    setCredentialModelsInput(credential.models.map((m) => m.model).join(", "));
    setCredentialDialogOpen(true);
  };

  const handleDeleteCredential = async (id: string) => {
    if (!confirm("确定要删除此凭证吗？")) return;

    try {
      await fetch(`/api/credentials/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Delete credential error:", error);
    }
  };

  // Mapping handlers
  const handleCreateMapping = async () => {
    try {
      const aliasMappings = mappings.filter((m) => m.alias === mappingAlias);
      const nextPriority = aliasMappings.length;

      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: mappingAlias,
          credentialModelId: mappingCredentialModelId,
          priority: nextPriority,
        }),
      });

      if (res.ok) {
        setMappingDialogOpen(false);
        setMappingAlias("nano");
        setMappingProviderId("");
        setMappingCredentialId("");
        setMappingCredentialModelId("");
        fetchData();
      }
    } catch (error) {
      console.error("Create mapping error:", error);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm("确定要删除此映射吗？")) return;

    try {
      await fetch(`/api/mappings/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Delete mapping error:", error);
    }
  };

  const handleToggleMapping = async (id: string, isEnabled: boolean) => {
    try {
      await fetch(`/api/mappings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      });
      fetchData();
    } catch (error) {
      console.error("Toggle mapping error:", error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, alias: string) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const aliasMappings = mappings
        .filter((m) => m.alias === alias)
        .sort((a, b) => a.priority - b.priority);

      const oldIndex = aliasMappings.findIndex((m) => m.id === active.id);
      const newIndex = aliasMappings.findIndex((m) => m.id === over.id);

      const reordered = arrayMove(aliasMappings, oldIndex, newIndex);

      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].priority !== i) {
          await fetch(`/api/mappings/${reordered[i].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: i }),
          });
        }
      }

      fetchData();
    }
  };

  // Get selected provider's credentials
  const selectedProvider = providers.find((p) => p.id === mappingProviderId);
  const availableCredentials = selectedProvider?.credentials ?? [];

  // Get selected credential's models
  const selectedCredential = availableCredentials.find((c) => c.id === mappingCredentialId);
  const availableModels = selectedCredential?.models ?? [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  const aliases = ["nano", "base", "pro"] as const;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">API 转发配置</h1>
          <Button variant="outline" onClick={handleLogout}>
            退出
          </Button>
        </div>

        {/* API 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>使用方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              将 API 请求发送到：
              <code className="bg-muted px-2 py-1 rounded">
                /v1/chat/completions
              </code>
            </p>
            <p>
              使用模型别名：
              <code className="bg-muted px-2 py-1 rounded">nano</code>、
              <code className="bg-muted px-2 py-1 rounded">base</code>、
              <code className="bg-muted px-2 py-1 rounded">pro</code>
            </p>
            <p>系统会自动根据配置的优先级和健康状态选择可用的后端 API。</p>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>用于调用转发 API 的密钥</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setApiKeyDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加 Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无 API Key，点击上方按钮添加
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono whitespace-nowrap">
                            {apiKey.key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleCopyApiKey(apiKey.key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(apiKey.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 供应商管理 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>供应商</CardTitle>
                <CardDescription>
                  添加 API 供应商（如 OpenAI、Azure 等）
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setProviderDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                添加供应商
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无供应商，点击上方按钮添加
              </p>
            ) : (
              providers.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">{provider.baseUrl}</p>
                      <p className="text-sm text-muted-foreground">
                        最大并发: {provider.maxConcurrency}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditProvider(provider)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProvider(provider.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 凭证表格 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">凭证</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProviderId(provider.id);
                          setCredentialDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加凭证
                      </Button>
                    </div>

                    {provider.credentials.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                        暂无凭证
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>凭证名称</TableHead>
                            <TableHead>模型</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {provider.credentials.map((cred) => (
                            <TableRow key={cred.id}>
                              <TableCell className="font-medium">{cred.name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {cred.models.map((m) => m.model).join(", ")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditCredential(provider.id, cred)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCredential(cred.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 模型映射 */}
        {aliases.map((alias) => {
          const aliasMappings = mappings
            .filter((m) => m.alias === alias)
            .sort((a, b) => a.priority - b.priority);

          return (
            <Card key={alias}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{alias}</CardTitle>
                    <CardDescription>拖拽行调整优先级顺序</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMappingAlias(alias);
                      setMappingDialogOpen(true);
                    }}
                    disabled={
                      providers.length === 0 ||
                      providers.every((p) => p.credentials.length === 0)
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加映射
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {aliasMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无映射，点击上方按钮添加
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, alias)}
                  >
                    <SortableContext
                      items={aliasMappings.map((m) => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead className="w-16">优先级</TableHead>
                            <TableHead>供应商</TableHead>
                            <TableHead>凭证</TableHead>
                            <TableHead>模型</TableHead>
                            <TableHead>启用</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aliasMappings.map((mapping, index) => (
                            <SortableMappingRow
                              key={mapping.id}
                              mapping={mapping}
                              index={index}
                              onToggle={handleToggleMapping}
                              onDelete={handleDeleteMapping}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provider Dialog */}
      <Dialog
        open={providerDialogOpen}
        onOpenChange={(open) => {
          setProviderDialogOpen(open);
          if (!open) {
            setEditingProvider(null);
            resetProviderForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "编辑供应商" : "添加供应商"}
            </DialogTitle>
            <DialogDescription>配置 API 供应商信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="如：OpenAI"
              />
            </div>
            <div className="space-y-2">
              <Label>API 基础 URL</Label>
              <Input
                value={providerBaseUrl}
                onChange={(e) => setProviderBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label>最大并发数</Label>
              <Input
                type="number"
                value={providerMaxConcurrency}
                onChange={(e) => setProviderMaxConcurrency(e.target.value)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={
                editingProvider ? handleUpdateProvider : handleCreateProvider
              }
            >
              {editingProvider ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Dialog */}
      <Dialog
        open={credentialDialogOpen}
        onOpenChange={(open) => {
          setCredentialDialogOpen(open);
          if (!open) {
            setEditingCredential(null);
            resetCredentialForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCredential ? "编辑凭证" : "添加凭证"}</DialogTitle>
            <DialogDescription>为供应商添加 API Key</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select
                value={selectedProviderId}
                onValueChange={(value) => {
                  if (value) setSelectedProviderId(value);
                }}
                disabled={!!editingCredential}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>凭证名称</Label>
              <Input
                value={credentialName}
                onChange={(e) => setCredentialName(e.target.value)}
                placeholder="如：主账号"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key {editingCredential && "（留空则不修改）"}</Label>
              <Input
                value={credentialApiKey}
                onChange={(e) => setCredentialApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label>模型（逗号分隔）</Label>
              <Input
                value={credentialModelsInput}
                onChange={(e) => setCredentialModelsInput(e.target.value)}
                placeholder="gpt-4o-mini, gpt-4o"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={editingCredential ? handleUpdateCredential : handleCreateCredential}>
              {editingCredential ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog
        open={apiKeyDialogOpen}
        onOpenChange={(open) => {
          setApiKeyDialogOpen(open);
          if (!open) {
            setNewApiKeyName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 API Key</DialogTitle>
            <DialogDescription>为你的 API Key 命名，方便识别用途</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                placeholder="如：生产环境、测试环境"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateApiKey} disabled={!newApiKeyName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog
        open={mappingDialogOpen}
        onOpenChange={(open) => {
          setMappingDialogOpen(open);
          if (!open) {
            setMappingProviderId("");
            setMappingCredentialId("");
            setMappingCredentialModelId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加映射 - {mappingAlias}</DialogTitle>
            <DialogDescription>选择要映射的模型</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select
                value={mappingProviderId}
                onValueChange={(value) => {
                  if (value) {
                    setMappingProviderId(value);
                    setMappingCredentialId("");
                    setMappingCredentialModelId("");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>凭证</Label>
              <Select
                value={mappingCredentialId}
                onValueChange={(value) => {
                  if (value) {
                    setMappingCredentialId(value);
                    setMappingCredentialModelId("");
                  }
                }}
                disabled={!mappingProviderId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      mappingProviderId ? "选择凭证" : "请先选择供应商"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      {cred.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>模型</Label>
              <Select
                value={mappingCredentialModelId}
                onValueChange={(value) => {
                  if (value) setMappingCredentialModelId(value);
                }}
                disabled={!mappingCredentialId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      mappingCredentialId ? "选择模型" : "请先选择凭证"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateMapping}
              disabled={!mappingCredentialModelId}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
