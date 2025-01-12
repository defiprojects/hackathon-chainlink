"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "next-auth/react";
import { type z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SmartContractSchema } from "types/schema";
import { Input } from "../Input";
import ButtonSpinner from "../../ButtonSpinner";
import FileSelectTable from "./file-select-table";
import Button from "../button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { signInWithGithub } from "lib/github-sign-in";
import { api } from "@/trpc/react";
import { cn } from "lib/utils";
import { useAccount, useContractWrite, useSwitchChain } from "wagmi";
import { avalancheFuji } from "viem/chains";
import { contracts } from "@/config/contracts";
import { parseEther } from "viem";
import { useToast } from "../../toast/use-toast";

type SmartContractFormProps = {
  setRequestId: (id: number) => void;
};

export default function SmartContractForm({
  setRequestId,
}: SmartContractFormProps) {
  const [tagText, setTagText] = useState<string>("");
  const { data, status } = useSession();
  const sendRequest = api.audit.createRequest.useMutation();
  const getRepos = api.github.getUserRepos.useQuery();
  const { isConnected: isWalletConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitchLoading } = useSwitchChain();
  const {
    writeContract,
    data: requestAuditData,
    isSuccess: isWriteSuccess,
    isPending: isWriteLoading,
  } = useContractWrite();

  const isConnected = useMemo(() => {
    return status === "authenticated" && isWalletConnected;
  }, [status, isWalletConnected]);

  const { toast } = useToast();

  useEffect(() => {
    if (isWalletConnected && sendRequest.isSuccess && sendRequest.data?.id) {
      if (chainId !== avalancheFuji.id) {
        switchChain({ chainId: avalancheFuji.id });
      }

      writeContract({
        abi: contracts.registry.abi,
        address: contracts.registry.address,
        functionName: "requestAudit",
        args: [BigInt(sendRequest.data?.id)],
        value: parseEther("0.1"),
      });

      toast({
        title: "Success 🎉",
        description: "Your request has been submitted",
      });

      setRequestId(29);
    }
  }, [isWalletConnected, sendRequest.isSuccess, sendRequest.data?.id]);

  const {
    handleSubmit,
    formState: { errors },
    register,
    setValue,
    watch,
  } = useForm<z.infer<typeof SmartContractSchema>>({
    resolver: zodResolver(SmartContractSchema),
    defaultValues: {
      title: "",
      repoName: "",
      repoOwner: "",
      filesInScope: [],
      tags: [],
    },
  });

  const setFiles = (files: string[]) => {
    setValue("filesInScope", files);
  };

  const tags = watch("tags");
  const repoName = watch("repoName");
  const repoOwner = watch("repoOwner");
  const onSubmit = (data: z.infer<typeof SmartContractSchema>) => {
    sendRequest.mutate({
      title: data.title,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      filesInScope: data.filesInScope,
      tags: data.tags,
    });
  };

  const addTag = (tag: string) => {
    if (tagText === "") return;
    setTagText("");
    setValue("tags", [...tags, tag]);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-row gap-6">
      <div className="w-full">
        <div className="flex w-full items-end gap-2">
          <Input
            type="text"
            placeholder="Give your code a Title"
            {...register("title")}
            error={errors.title?.message}
            className="w-[70%]"
          />
          <Input
            type="text"
            placeholder="Insert Tag"
            onChange={(e) => setTagText(e.target.value)}
            value={tagText}
            error={errors.title?.message}
            className="w-[20%]"
          />
          <Button
            className="text-l inline-flex h-11 w-[20%] items-center gap-2 rounded bg-dark-darkLight px-4 py-1 font-bold text-primary-purpleMedium"
            type="button"
            onClick={() => addTag(tagText)}
          >
            <Image
              src="/label.svg"
              alt="label icon"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            Add Tag
          </Button>
        </div>
        <div className="h-6" />
        <>
          <div className="flex items-center gap-2">
            <Image
              src="/label_green.svg"
              alt="label icon"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <h2 className="text-2xl font-bold text-primary-green">
              Your code tags.
            </h2>
          </div>
          <div className="h-2" />
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <div
                key={index}
                className="inline-flex rounded-full border border-primary-purpleMedium px-4 py-1"
              >
                <p className="font-bold text-primary-purpleMedium">{tag}</p>
              </div>
            ))}
          </div>
        </>
        <div className="h-6" />
        <div className="rounded-lg border border-primary-purpleMedium bg-dark-darkMain">
          <div
            className={cn([
              "bg-dark-darkLight",
              status === "authenticated" ? "rounded-lg" : "rounded-t-lg",
            ])}
          >
            <div className="h-4" />
            {status === "authenticated" ? (
              <div className="flex items-center gap-4 px-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={data?.user.image ?? "https://github.com/shadcn.png"}
                  />
                  <AvatarFallback>0x</AvatarFallback>
                </Avatar>
                <p className="text-xl font-semibold">{data?.user.name}</p>
              </div>
            ) : (
              <div className="flex items-center px-4">
                <Button
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-purpleMedium px-4 py-1 text-[32px] font-bold text-white"
                  onClick={signInWithGithub}
                  type="button"
                >
                  <Image
                    src="/github.svg"
                    alt="GitHub Logo"
                    width={20}
                    height={20}
                    className="h-10 w-10"
                  />
                  GitHub
                  <span className="text-[16px] font-normal">Connect</span>
                </Button>
              </div>
            )}
            <div className="h-4" />
          </div>

          <div className="pl-4 pr-2">
            {status === "authenticated" &&
              getRepos.isFetched &&
              getRepos.data && (
                <>
                  <div className="h-4" />
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="repoSelect"
                      className="text-xl font-bold text-white"
                    >
                      Select a Repository
                    </label>
                    <select
                      id="repoSelect"
                      onChange={(e) => {
                        const [owner, name] = e.target.value.split("/");
                        if (!owner || !name) return;
                        setValue("repoOwner", owner);
                        setValue("repoName", name);
                      }}
                      className="rounded-md bg-dark-darkLight p-2 text-white"
                    >
                      <option value="">Select a repository</option>
                      {getRepos.data.map((repo, index) => (
                        <option
                          key={index}
                          value={`${repo.owner}/${repo.name}`}
                        >
                          {repo.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="h-4" />
                  {repoName && repoOwner && (
                    <FileSelectTable
                      setSelectedFiles={setFiles}
                      repoOwner={repoOwner}
                      repoName={repoName}
                    />
                  )}
                </>
              )}
          </div>
        </div>
      </div>
      <div className="relative w-1/2 justify-between">
        <ButtonSpinner
          isLoading={sendRequest.isPending || isSwitchLoading || isWriteLoading}
          defaultContent="Audit My Smart Contract"
          loadingContent="Loading..."
          className="mb-4 w-full rounded-lg bg-primary-green px-4 py-2 text-2xl font-bold text-dark-darkMain"
        />
        <Image
          src="/starsIcons.png"
          alt="Stars Icons"
          width={160}
          height={111}
          className="absolute -right-8 top-16 h-28 w-40"
        />

        <p className="relative pr-6 text-2xl font-bold">
          Deliver safer code, and get audited in seconds with data rich AI.
        </p>
      </div>
    </form>
  );
}
