"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
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
  maxConcurrency: number;
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

export default function DashboardPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);

  // Provider dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");

  // Credential dialog states
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [credentialName, setCredentialName] = useState("");
  const [credentialApiKey, setCredentialApiKey] = useState("");
  const [credentialModelsInput, setCredentialModelsInput] = useState("");

  // Mapping dialog states
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingAlias, setMappingAlias] = useState<"nano" | "base" | "pro">("nano");
  const [mappingCredentialModelId, setMappingCredentialModelId] = useState("");
  const [mappingPriority, setMappingPriority] = useState("0");
  const [mappingMaxConcurrency, setMappingMaxConcurrency] = useState("10");

  const fetchData = async () => {
    try {
      const [providersRes, mappingsRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/mappings"),
      ]);
      
      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers);
      }
      
      if (mappingsRes.ok) {
        const data = await mappingsRes.json();
        setMappings(data.mappings);
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

  const handleCreateProvider = async () => {
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: providerName, baseUrl: providerBaseUrl }),
      });
      
      if (res.ok) {
        setProviderDialogOpen(false);
        setProviderName("");
        setProviderBaseUrl("");
        fetchData();
      }
    } catch (error) {
      console.error("Create provider error:", error);
    }
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

  const handleCreateCredential = async () => {
    try {
      const models = credentialModelsInput.split(",").map(m => m.trim()).filter(Boolean);
      
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
        setCredentialName("");
        setCredentialApiKey("");
        setCredentialModelsInput("");
        fetchData();
      }
    } catch (error) {
      console.error("Create credential error:", error);
    }
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

  const handleCreateMapping = async () => {
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: mappingAlias,
          credentialModelId: mappingCredentialModelId,
          priority: parseInt(mappingPriority),
          maxConcurrency: parseInt(mappingMaxConcurrency),
        }),
      });
      
      if (res.ok) {
        setMappingDialogOpen(false);
        setMappingAlias("nano");
        setMappingCredentialModelId("");
        setMappingPriority("0");
        setMappingMaxConcurrency("10");
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

  // 获取所有可用的 credentialModel 选项
  const credentialModelOptions = providers.flatMap(p => 
    p.credentials.flatMap(c => 
      c.models.map(m => ({
        id: m.id,
        label: `${p.name} / ${c.name} / ${m.model}`,
      }))
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">API 转发配置</h1>
          <Button variant="outline" onClick={handleLogout}>退出</Button>
        </div>

        {/* API 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>使用方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>将 API 请求发送到：<code className="bg-muted px-2 py-1 rounded">/api/v1/chat/completions</code></p>
            <p>使用模型别名：<code className="bg-muted px-2 py-1 rounded">nano</code>、<code className="bg-muted px-2 py-1 rounded">base</code>、<code className="bg-muted px-2 py-1 rounded">pro</code></p>
            <p>系统会自动根据配置的优先级和健康状态选择可用的后端 API。</p>
          </CardContent>
        </Card>

        {/* 供应商管理 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>供应商</CardTitle>
                <CardDescription>添加 API 供应商（如 OpenAI、Azure 等）</CardDescription>
              </div>
              <Button size="sm" onClick={() => setProviderDialogOpen(true)}>添加供应商</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无供应商</p>
            ) : (
              providers.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">{provider.baseUrl}</p>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteProvider(provider.id)}
                    >
                      删除
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  {/* 凭证列表 */}
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
                        添加凭证
                      </Button>
                    </div>
                    
                    {provider.credentials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无凭证</p>
                    ) : (
                      provider.credentials.map((cred) => (
                        <div key={cred.id} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">{cred.name}</span>
                            <span className="text-muted-foreground ml-2">
                              ({cred.models.map(m => m.model).join(", ")})
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteCredential(cred.id)}
                          >
                            删除
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 模型映射 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>模型映射</CardTitle>
                <CardDescription>将 nano/base/pro 映射到实际模型</CardDescription>
              </div>
              <Button size="sm" onClick={() => setMappingDialogOpen(true)}>添加映射</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mappings.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无映射</p>
            ) : (
              ["nano", "base", "pro"].map((alias) => {
                const aliasMappings = mappings.filter(m => m.alias === alias);
                if (aliasMappings.length === 0) return null;
                
                return (
                  <div key={alias} className="space-y-2">
                    <p className="font-medium">{alias}</p>
                    {aliasMappings.map((mapping) => (
                      <div key={mapping.id} 
                           className="flex justify-between items-center border rounded p-3 text-sm">
                        <div className="space-y-1">
                          <p>
                            {mapping.credentialModel.credential.provider.name} / 
                            {mapping.credentialModel.credential.name} / 
                            {mapping.credentialModel.model}
                          </p>
                          <p className="text-muted-foreground">
                            优先级: {mapping.priority} | 
                            并发: {mapping.maxConcurrency} |
                            状态: {mapping.isEnabled ? "启用" : "禁用"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleToggleMapping(mapping.id, mapping.isEnabled)}
                          >
                            {mapping.isEnabled ? "禁用" : "启用"}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteMapping(mapping.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加供应商</DialogTitle>
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
          </div>
          <DialogFooter>
            <Button onClick={handleCreateProvider}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential Dialog */}
      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加凭证</DialogTitle>
            <DialogDescription>为供应商添加 API Key</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>凭证名称</Label>
              <Input 
                value={credentialName} 
                onChange={(e) => setCredentialName(e.target.value)}
                placeholder="如：主账号"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
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
            <Button onClick={handleCreateCredential}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加映射</DialogTitle>
            <DialogDescription>配置模型别名映射</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>别名</Label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={mappingAlias}
                onChange={(e) => setMappingAlias(e.target.value as "nano" | "base" | "pro")}
              >
                <option value="nano">nano</option>
                <option value="base">base</option>
                <option value="pro">pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>凭证模型</Label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={mappingCredentialModelId}
                onChange={(e) => setMappingCredentialModelId(e.target.value)}
              >
                <option value="">选择...</option>
                {credentialModelOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>优先级（数字越小越优先）</Label>
              <Input 
                type="number"
                value={mappingPriority} 
                onChange={(e) => setMappingPriority(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>最大并发数</Label>
              <Input 
                type="number"
                value={mappingMaxConcurrency} 
                onChange={(e) => setMappingMaxConcurrency(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateMapping}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
